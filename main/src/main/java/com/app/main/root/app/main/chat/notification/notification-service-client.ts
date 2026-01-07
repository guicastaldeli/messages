import { SocketClientConnect } from "../../socket-client-connect";
import { ApiClientController } from "../../_api-client/api-client-controller";
import { AddNotification } from "./add-notification";

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

export class NotificationServiceClient {
    private socketClient: SocketClientConnect;
    private apiClientController: ApiClientController;
    
    private notifications: Map<string, Data> = new Map();
    private notificationCallbacks: Set<(data: Data[]) => void> = new Set();

    private unreadCount: number = 0;
    private countCallbacks: Set<(count: number) => void> = new Set();

    public userId!: string;
    public username!: string;

    constructor(socketClient: SocketClientConnect, apiClientController: ApiClientController) {
        this.socketClient = socketClient;
        this.apiClientController = apiClientController;
    }

    private async init(): Promise<void> {
        await AddNotification().init(this);
        await this.setupListeners();
    }

    public async getUserData(userId: string, username: string): Promise<void> {
        this.userId = userId;
        this.username = username;
        await this.setupListeners();
    }

    /**
     * Setup Listeners
     */
    private async setupListeners(): Promise<void> {
        this.socketClient.on('/user/queue/notifications', (data: any) => {
            this.handleIncomingNotification(data);
        });
        this.socketClient.on('/queue/messages', (data: any) => {
            if(shouldAddNotification(data)) {
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

        const activeChatId = this.getActiveChatId();
        if(message.chatId === activeChatId) return false;
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
}