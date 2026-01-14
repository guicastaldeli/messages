import { SocketClientConnect } from "../../socket-client-connect";
import { ApiClientController } from "../../_api-client/api-client-controller";
import { getAddNotification } from "./add-notification";
import { NotificationServiceClient } from "./notification-service-client";

export enum Type {
    MESSAGE = 'MESSAGE',
    FILE = 'FILE',
    SYSTEM = 'SYSTEM'
}

enum Priority {
    LOW = 'LOW',
    NORMAL = 'NORMAL',
    HIGH = 'HIGH'
}
    
export interface Data {
    id: string;
    userId: string;
    type: Type | string;
    title: string;
    message: string;
    chatId: string;
    senderId: string;
    senderName: string;
    timestamp: Date;
    isRead: boolean;
    _typeOverride?: string;
    priority: Priority | string;
    metadata?: any;
}

export class NotificationControllerClient {
    private socketClient: SocketClientConnect;
    private apiClientController: ApiClientController;
    private notificationService: NotificationServiceClient;
    
    public notifications: Map<string, Data> = new Map();
    public notificationCallbacks: Set<(data: Data[]) => void> = new Set();

    public unreadCount: number = 0;
    public countCallbacks: Set<(count: number) => void> = new Set();

    public userId!: string;
    public username!: string;

    constructor(socketClient: SocketClientConnect, apiClientController: ApiClientController) {
        this.socketClient = socketClient;
        this.apiClientController = apiClientController;
        this.notificationService = new NotificationServiceClient(this.apiClientController, this);
    }

    public async init(userId: string, username: string): Promise<void> {
        this.getUserData(userId, username);
        const addNotification = getAddNotification();
        await addNotification.init(this);
        await this.setupListeners();
    }

    private async getUserData(userId: string, username: string): Promise<void> {
        this.userId = userId;
        this.username = username;
    }

    private getActiveChat(): string | null {
        return localStorage.getItem('active-chat');
    }

    /**
     * Setup Listeners
     */
    private async setupListeners(): Promise<void> {
        this.socketClient.on('/user/queue/notifications', (data: any) => {
            this.handleIncomingNotification(data);
        });
        this.socketClient.on('/queue/notifications', (data: any) => {
            this.handleIncomingNotification(data);
        });
        this.socketClient.on('/queue/messages', (data: any) => {
            if(this.shouldAddNotification(data)) {
                this.createNotification(data);
            }
        });
    }

    private shouldAddNotification(message: any): boolean {
        if(!message.senderId && !message.senderUsername && !message.senderName) {
            return false;
        }
        
        const senderIdentifiers = [
            message.senderId,
            message.senderUsername,
            message.senderName,
            message.username
        ];
        
        const currentUserIdentifiers = [
            this.userId,
            this.username
        ];
        
        const isFromCurrentUser = senderIdentifiers.some(senderId =>
            senderId && currentUserIdentifiers.includes(senderId)
        );
        
        return !isFromCurrentUser;
    }

    /**
     * Create Notification
     */
    private async createNotification(data: any): Promise<void> {
        if(!this.shouldAddNotification(data)) return;
        try {
            const messageType = this.detectMessageType(data);
            const addNotification = getAddNotification();
            switch(messageType) {
                case Type.MESSAGE:
                    await addNotification.addMessage(data);
                    break;
                case Type.FILE:
                    await addNotification.addFile(data);
                    break;
                case Type.SYSTEM:
                    await addNotification.addSystemMessage(data);
                    break;
                default:
                    console.warn('Unknown message type:', messageType, data);
                    await addNotification.addMessage(data);
                    break;
            }
        } catch(err) {
            console.log(err);
            throw err;
        }
    }

    private detectMessageType(data: any): string {
        if(data._typeOverride) return data._typeOverride;
        if(data.type) {
            const type = String(data.type).toUpperCase();
            for(const t in Type) {
                if(t.includes(type)) {
                    return type;
                }
            }
        }

        if(data.fileData || data.fileId || data.originalFileName) {
            return Type.FILE;
        }
        if(data.isSystem || 
            data.event?.includes('SYSTEM') || 
            data.messageType === 'SYSTEM'
        ) {
            return Type.SYSTEM;
        }
        
        return Type.MESSAGE;
    }

    /**
     * Handle Incoming Notification
     */
    private handleIncomingNotification(data: any): void {
        const content: Data = {
            id: data.id,
            userId: data.userId,
            type: data.type,
            title: data.title,
            message: data.message,
            chatId: data.chatId,
            senderId: data.senderId,
            senderName: data.senderName,
            _typeOverride: data.type,
            timestamp: new Date(data.timestamp),
            isRead: data.isRead || false,
            priority: data.priority || Priority.NORMAL,
            metadata: data.metadata
        }
        
        this.addNotification(content);
        this.showDesktopNotification(content);
    }

    /**
     * Add Notification
     */
    public async addNotification(data: Data): Promise<void> {
        const activeChatId = this.getActiveChat();
        const isActiveChat = data.chatId === activeChatId;
        const notificationData = {
            ...data,
            isRead: isActiveChat
        }
        this.notifications.set(data.id, notificationData);
        if(!notificationData.isRead) {
            this.unreadCount++;
            this.updateBadgeCount();
            if(data.chatId && data.chatId !== 'system') {
                const unreadEvent = new CustomEvent('chat-unread-updated', {
                    detail: {
                        chatId: data.chatId,
                        unreadCount: this.getChatUnreadCount(data.chatId),
                        notification: data
                    }
                });
                window.dispatchEvent(unreadEvent);
            }
        }
        
        this.notifySubscribers();
        this.showDesktopNotification(data);
        await this.notificationService.persistNotification(data);
    }

    public showDesktopNotification(data: Data): void {
        if(!('Notification' in window)) return;
        if(Notification.permission === 'granted') {
            const notification = new Notification(data.title, {
                body: data.message,
                icon: '',
                tag: data.chatId,
                requireInteraction: data.priority === Priority.HIGH
            });
            notification.onclick = () => {
                window.focus();
                notification.close();
                this.handleNotificationClick(data);
            }
            setTimeout(() => {
                notification.close();
            }, data.priority === Priority.HIGH ? 10000 : 5000);
        } else if(Notification.permission !== 'denied') {
            Notification.requestPermission().then(permission => {
                if(permission === 'granted') {
                    this.showDesktopNotification(data);
                }
            });
        }
    }

    public getChatUnreadCount(chatId: string): number {
        return Array.from(this.notifications.values()).filter(nt => 
            nt.chatId === chatId && !nt.isRead
        ).length;
    }

    /**
     * Mark as Read
     */
    public async markAsRead(notificationId: string): Promise<void> {
        const notification = this.notifications.get(notificationId);
        if(notification && !notification.isRead) {
            notification.isRead = true;
            this.unreadCount--;
            this.updateBadgeCount();
            this.notifySubscribers();
            await this.notificationService.updateNotificationStatus(notificationId, true);
        }
    }

    public async markAllAsRead(): Promise<void> {
        for(const [id, notification] of this.notifications) {
            if(!notification.isRead) {
                notification.isRead = true;
                await this.notificationService.updateNotificationStatus(id, true);
            }
        }
        this.unreadCount = 0;
        this.updateBadgeCount();
        this.notifySubscribers();
        await this.notificationService.markAllAsRead();
    }

    /**
     * Delete Notification
     */
    public async deleteNotification(notificationId: string): Promise<void> {
        const notification = this.notifications.get(notificationId);
        if(notification) {
            if(!notification.isRead) {
                this.unreadCount--;
                this.updateBadgeCount();
            }
            this.notifications.delete(notificationId);
            this.notifySubscribers();
            await this.notificationService.deleteNotification(notificationId);
        }
    }

    public getNotificationTitle(data: any): string {
        if(data.chatType === 'DIRECT') {
            return `New message from ${data.username || data.senderName}`;
        } else {
            return `New message in ${data.groupName || 'Group'}`;
        }
    }

    public getNotifications(): Data[] {
        const notifications = Array.from(this.notifications.values())
            .sort((a, b) => {
                try {
                    const dateA = a.timestamp instanceof Date ? a.timestamp : new Date(a.timestamp);
                    const dateB = b.timestamp instanceof Date ? b.timestamp : new Date(b.timestamp);
                    
                    const timeA = dateA.getTime() || 0;
                    const timeB = dateB.getTime() || 0;
                    
                    return timeB - timeA;
                } catch (err) {
                    console.error('Error sorting notifications:', err, { a, b });
                    return 0;
                }
            });
        
        return notifications;
    }

    public notifySubscribers(): void {
        const notifications = this.getNotifications();
        this.notificationCallbacks.forEach(cb => {
            try {
                cb(notifications);
            } catch(err) {
                console.error(err);
            }
        });
    }

    public updateBadgeCount(): void {
        this.countCallbacks.forEach(cb => {
            try {
                cb(this.unreadCount);
            } catch(err) {
                console.error(err);
            }
        });
        this.updateDocTitle();
    }

    private updateDocTitle(): void {
        const regex = /^\(\d+\)\s*/;
        const title = document.title.replace(regex, '');
        if(this.unreadCount > 0) {
            document.title = `(${this.unreadCount}) ${title}`;
        } else {
            document.title = title;
        }
    }

    public formatMessagePreview(content: string): string {
        const count = 20;
        if(!content) return "";
        if(content.length > count) {
            return content.substring(0, count) + '...';
        }
        return content;
    }

    private handleNotificationClick(notification: Data): void {
        const e = new CustomEvent('notification-clicked', {
            detail: { notification }
        });
        window.dispatchEvent(e);
    }

    /**
     * Get Notification Service
     */
    public async getNotificationSevrice(): Promise<NotificationServiceClient> {
        return this.notificationService;
    }
}