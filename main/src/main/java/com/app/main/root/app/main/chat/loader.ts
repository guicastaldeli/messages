import { SocketClientConnect } from "../socket-client-connect";
import { ApiClient } from "../_api-client/api-client";
import { MessageManager } from "../_messages_config/message-manager";
import { CacheServiceClient } from "@/app/_cache/cache-service-client";

export class Loader {
    private socketClient: SocketClientConnect;
    private apiClient: ApiClient;
    private messageManager: MessageManager;
    private cacheService: CacheServiceClient;

    private socketId: string | null = null;
    private userId: string | null = null;
    private username: string | null = null;

    constructor(
        socketClient: SocketClientConnect, 
        apiClient: ApiClient,
        messageManager: MessageManager,
        cacheService: CacheServiceClient
    ) {
        this.socketClient = socketClient;
        this.apiClient = apiClient;
        this.messageManager = messageManager;
        this.cacheService = cacheService;
    }

    public async getUserData(sessionId: string, userId: string, username: string): Promise<void> {
        this.socketId = sessionId;
        this.userId = userId;
        this.username = username;
    }

    /*
    ** Load History Messages
    */
    public async loadMessagesHistory(id: string): Promise<void> {
        try {
            const cachedMessages = await this.cacheService.getMessages(id, 0);
            if(cachedMessages.length > 0) {
                console.log(`Loaded ${cachedMessages.length} messages for ${id}`);
                for(const message of cachedMessages) {
                    const updMessage = {
                        ...message,
                        currentUserId: this.userId,
                        currentSessionId: this.socketId
                    }
                    await this.messageManager.renderHistory(updMessage);
                }
            } else {
                console.log('No cached messages! loding from API.');
                const service = await this.apiClient.getMessageService();
                const messages = await service.getMessagesByChatId(id, 0);
                if(messages && Array.isArray(messages)) {
                    for(const message of messages) {
                        const updMessage = {
                            ...message,
                            currentUserId: this.userId,
                            currentSessionId: this.socketId
                        }
                        await this.messageManager.renderHistory(updMessage);
                    }
                    this.cacheMessages(id, messages);
                }
            }
        } catch(err) {
            console.error('Failed to load messages: ', err);
        }
    }

    private cacheMessages(chatId: string, messages: any[]): void {
        try {
            const pageSize = 20;
            for(let page = 0; page < Math.ceil(messages.length / pageSize); page++) {
                const startIdx = page * pageSize;
                const endIdx = Math.min(startIdx + pageSize, messages.length);
                const pageMessages = messages.slice(startIdx, endIdx);
                this.cacheService.addMessagesPage(chatId, pageMessages, page);
            }
            this.cacheService.init(chatId, messages.length);
        } catch(err) {
            console.error('Failed to cache messages!:', err);
        }
    }

    private async loadHistory(userId: string): Promise<any[]> {
        return new Promise(async (res, rej) => {
            const sucssDestination = '/queue/user-chats-scss';
            const errDestination = '/queue/user-chats-err';

            /* Success */
            const handleSucss = (data: any) => {
                this.socketClient.offDestination(sucssDestination, handleSucss);
                this.socketClient.offDestination(errDestination, handleErr);

                let chats: any[] = [];
                if(data && typeof data === 'object') {
                    const directChats = Array.isArray(data.direct) ? data.direct : [];
                    const groupChats = Array.isArray(data.groups) ? data.groups : [];
                    chats = [...directChats, ...groupChats];
                }
                res(chats);
            }

            /* Error */
            const handleErr = (error: any) => {
                this.socketClient.offDestination(sucssDestination, handleSucss);
                this.socketClient.offDestination(errDestination, handleErr);
                rej(new Error(error.message));
            }

            try {
                this.socketClient.onDestination(sucssDestination, handleSucss);
                this.socketClient.onDestination(errDestination, handleErr);

                await this.socketClient.sendToDestination(
                    '/app/get-user-chats',
                    { userId: userId },
                    sucssDestination
                );
            } catch(err) {
                this.socketClient.offDestination(sucssDestination, handleSucss);
                this.socketClient.offDestination(errDestination, handleErr);
                rej(err);
            }
        });
    }

    public async loadChats(userId: string): Promise<any> {
        try {
            await new Promise(res => setTimeout(res, 500));
            const chats = await this.loadHistory(userId);
            if(!chats || chats.length === 0) return;

            for(const chat of chats) {
                const lastMessage = await this.lastMessage(chat.id);
                const type = chat.type;
                console.log(chat);

                const chatEvent = new CustomEvent('chat-item-added', {
                    detail: {
                        id: chat.chatId,
                        chatId: chat.id,
                        groupId: chat.id,
                        name: chat.name || chat.contactUsername,
                        type: type,
                        creator: chat.creator || chat.creatorId,
                        members: [],
                        unreadCount: 0,
                        lastMessage: lastMessage,
                        lastMessageTime: chat.createdAt
                    }
                });
                window.dispatchEvent(chatEvent);
            }
        } catch(err) {
            console.error(err);
        }
    }

    /*
    ** Last Message
    */
    public async lastMessage(id: string): Promise<string> {
        try {
            const service = await this.apiClient.getMessageService();
            const res = await service.getMessagesByChatId(id, 0);
            const messages = res.messages || [];
            if(messages && messages.length > 0) {
                const lastMessage = messages[messages.length - 1];
                return lastMessage.content;
            }
        } catch(err) {
            console.error('Failed to get recent messages', err);
        }

        return '';
    }

    public updateLastMessage(
        id: string,
        userId: string,
        messageId: string,
        content: string,
        sender: string,
        isSystem: boolean
    ): void {
        const time = new Date().toISOString();
        const updateEvent = new CustomEvent('last-message-updated', {
            detail: {
                chatId: id,
                userId: userId,
                messageId: messageId,
                lastMessage: content,
                sender: sender,
                timestamp: time,
                isCurrentUser: sender === this.username,
                isSystem: isSystem
            }
        });
        window.dispatchEvent(updateEvent);
    }
}