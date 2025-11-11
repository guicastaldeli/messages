import { SocketClientConnect } from "../socket-client-connect";
import { ChatManager } from "./chat-manager";

export class Loader {
    private socketClient: SocketClientConnect;
    private chatManager: ChatManager;

    constructor(
        socketClient: SocketClientConnect,
        chatManager: ChatManager
    ) {
        this.socketClient = socketClient;
        this.chatManager = chatManager;
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
                const lastMessage = await this.chatManager.lastMessage(chat.id);
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

   
}