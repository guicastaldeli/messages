import { SocketClientConnect } from "../../socket-client-connect";
import { ApiClientController } from "../../_api-client/api-client-controller";
import { AddNotification } from "./add-notification";
import { NotificationServiceClient } from "./notification-service-client";

export enum Type {
    MESSAGE = 'MESSAGE',
    FILE = 'FILE',
    SYSTEM = 'SYSTEM'
}
    
export interface Data {
    id: string;
    userId: string;
    type: Type;
    title: string;
    message: string;
    chatId: string;
    senderId: string;
    senderName: string;
    timestamp: Date;
    isRead: boolean;
    priority: 'LOW' | 'NORMAL' | 'HIGH';
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
        await AddNotification().init(this);
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
        this.socketClient.on('/queue/messages', (data: any) => {
            if(this.shouldAddNotification(data)) {
                this.createNotification(data);
            }
        });
        this.socketClient.on('/user/queue/notifications', (data: any) => {
            this.handleIncomingNotification(data);
        });
    }

    private shouldAddNotification(message: any): boolean {
        if(message.senderId === this.userId || 
            message.senderId === this.username
        ) {
            return false;
        }

        const activeChatId = this.getActiveChat();
        if(message.chatId === activeChatId) return false;

        return false;
    }

    /**
     * Create Notification
     */
    private async createNotification(data: any): Promise<void> {
        if(!this.shouldAddNotification(data)) return;
        try {
            const messageType = this.detectMessageType(data);
            switch(messageType) {
                case Type.MESSAGE:
                    await AddNotification().addMessage(data);
                    break;
                case Type.FILE:
                    await AddNotification().addFile(data);
                    break;
                case Type.SYSTEM:
                    await AddNotification().addSystemMessage(data);
                    break;
                default:
                    console.warn('Unknown message type:', messageType, data);
                    await AddNotification().addMessage(data);
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
            timestamp: new Date(data.timestamp),
            isRead: data.isRead || false,
            priority: data.priority || 'NORMAL',
            metadata: data.metadata
        }
        this.addNotification(content);
        if(!data.isRead) this.showDesktopNotification(content);
    }

    /**
     * Add Notification
     */
    public async addNotification(data: Data): Promise<void> {
        this.notifications.set(data.id, data);
        if(data.isRead) {
            this.unreadCount++;
            this.updateBadgeCount();
        }
        this.notifySubscribers();
        await this.notificationService.persistNotification(data);
    }

    public showDesktopNotification(data: Data): void {
        if(!('Notification' in window)) return;
        if(Notification.permission === 'granted') {
            const notification = new Notification(data.title, {
                body: data.message,
                icon: '',
                tag: data.chatId,
                requireInteraction: data.priority === 'HIGH'
            });
            notification.onclick = () => {
                window.focus();
                notification.close();
                this.handleNotificationClick(data);
            }
            setTimeout(() => {
                notification.close();
            }, data.priority === 'HIGH' ? 10000 : 5000);
        } else if(Notification.permission !== 'denied') {
            Notification.requestPermission().then(permission => {
                if(permission === 'granted') {
                    this.showDesktopNotification(data);
                }
            });
        }
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
        return Array.from(this.notifications.values())
            .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
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
}