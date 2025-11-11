import { SocketClientConnect } from "../socket-client-connect";
import { ApiClient } from "../_api-client/api-client";
import { ChatManager } from "./chat-manager";
import { ChatStateManager } from "./chat-state-manager";

export class Loader {
    private socketClient: SocketClientConnect;
    private apiClient: ApiClient;
    private chatManager: ChatManager;
    private chatStateManager = ChatStateManager.getIntance();

    constructor(
        socketClient: SocketClientConnect,
        apiClient: ApiClient,
        chatManager: ChatManager
    ) {
        this.socketClient = socketClient;
        this.apiClient = apiClient;
        this.chatManager = chatManager;
    }

    /*
    ** Load Chat History
    */
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

    /*
    ** Load Chat Items
    */
    public async loadChatItems(userId: string): Promise<any> {
        try {
            await new Promise(res => setTimeout(res, 500));
            const chats = await this.loadHistory(userId);
            if(!chats || chats.length === 0) return;

            for(const chat of chats) {
                const shouldContinue = await this.setChatState(chat);
                if(!shouldContinue) continue;

                const chatEvent = new CustomEvent('chat-item-added', {
                    detail: {
                        id: chat.id,
                        chatId: chat.id,
                        groupId: chat.id,
                        name: chat.name || chat.contactUsername,
                        type: chat.type,
                        creator: chat.creator || chat.creatorId,
                        members: [],
                        unreadCount: 0,
                        lastMessage: await this.setLastMessage(chat),
                        lastMessageTime: chat.createdAt
                    }
                });
                window.dispatchEvent(chatEvent);
            }
        } catch(err) {
            console.error(err);
        }
    }

    private async chatHasMessages(id: string): Promise<boolean> {
        try {
            const service = await this.apiClient.getMessageService();
            const res = await service.getMessagesByChatId(id);
            return res.messages && res.messages.length > 0;
        } catch(err) {
            console.error('Failed to check messages', err);
            return false;
        }
    }

    private async setLastMessage(chat: any): Promise<string> {
        const chatId = chat.id;
        const lastMessageData = await this.chatManager.lastMessage(chatId);
        if(!lastMessageData) return 'Err';
        const formattedMessage = this.chatManager.formattedMessage(
            chatId,
            lastMessageData.content,
            lastMessageData.sender,
            chatId,
            lastMessageData.isSystem
        );

        if(chat.type === 'DIRECT') {
            return formattedMessage; 
        } else {
            return this.chatManager.formattedLastMessage(formattedMessage);
        }
    }

    private async setChatState(chat: any): Promise<boolean> {
        const chatId = chat.id;
        const type = chat.type;
        if(type === 'DIRECT') {
            const hasMessages = await this.chatHasMessages(chatId);
            this.chatStateManager.initChatState(chatId, hasMessages ? 1 : 0);
            if(!hasMessages) return false;
        }
        return true;
    }
}