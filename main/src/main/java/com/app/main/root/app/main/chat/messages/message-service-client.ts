import { SocketClientConnect } from "../../socket-client-connect";

export class MessageServiceClient {
    private url: string | undefined;
    private socketClient: SocketClientConnect;

    constructor(url: string | undefined, socketClient: SocketClientConnect) {
        this.url = url;
        this.socketClient = socketClient;
    }

    /**
     * Save
     */
    public async saveMessages(
        data: {
            messageId: string;
            content: string;
            senderId: string;
            username: string;
            chatId: string | undefined;
            messageType: String;
            direction: string;
        }
    ): Promise<any> {
        const res = await fetch(`${this.url}/api/message/messages`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        });
        if(!res.ok) throw new Error('Failed to save messages!');
        return res.json();
    }

    /**
     * Tracked Messages
     */
    public async getTrackedMessages(): Promise<any[]> {
        const res = await fetch(`${this.url}/api/message/get-messages`);
        if(!res.ok) throw new Error('Failed to fetch tracked messages!');
        return res.json();
    }

    public async decryptMessage(id: string, data: any): Promise<any> {
        return new Promise(async (res, rej) => {
            const succssDestination = '/queue/decrypted-messages-scss';
            const errDestination = '/queue/decrypted-messages-err';

            const handlesuccss = (response: any) => {
                this.socketClient.offDestination(succssDestination, handlesuccss);
                this.socketClient.offDestination(errDestination, handleErr);
                if(response.messages && response.messages.length > 0) {
                    res(response.messages[0]);
                } else {
                    rej(new Error('No decrypted messages returned'));
                }
            };

            const handleErr = (error: any) => {
                this.socketClient.offDestination(succssDestination, handlesuccss);
                this.socketClient.offDestination(errDestination, handleErr);
                rej(new Error(error.message || 'Failed to decrypt message'));
            };

            try {
                this.socketClient.onDestination(succssDestination, handlesuccss);
                this.socketClient.onDestination(errDestination, handleErr);
                
                const payload = { 
                    messages: [data],
                    chatId: String(data.chatId || id)
                };

                await this.socketClient.sendToDestination(
                    '/app/get-decrypted-messages',
                    payload,
                    succssDestination
                );
            } catch(err) {
                this.socketClient.offDestination(succssDestination, handlesuccss);
                this.socketClient.offDestination(errDestination, handleErr);
                rej(err);
            }
        });
    }

    /**
     * Get Count by Chat Id
     */
    public async getMessageCountByChatId(chatId: string): Promise<number> {
        const res = await fetch(
            `${this.url}/api/message/messages/chatId/${chatId}/count`
        );
        if(!res.ok) throw new Error('Failed to fetch messages count');
        
        const data = await res.json();
        return typeof data === 'number' ? data : (data.count || data.total || 0);
    }

    /**
     * Recent Chats
     */
    public async getRecentMessages(
        userId: string,
        page: number = 0,
        pageSize: number = 20
    ): Promise<{
        chats: any[];
        currentPage: number;
        pageSize: number;
        totalChats: number;
        totalPages: number;
        hasMore: boolean
    }> {
        try {
            const res = await fetch(
                `${this.url}/api/message/messages/recent/${userId}?page=${page}&pageSize=${pageSize}`
            );
            if(!res.ok) throw new Error('Failed to fetch recent chats');
            
            const data = await res.json();
            return {
                chats: data.chats || [],
                currentPage: data.page || page,
                pageSize: data.pageSize || pageSize,
                totalChats: data.total || (data.chats ? data.chats.length : 0),
                totalPages: Math.ceil((data.total || (data.chats ? data.chats.length : 0)) / (data.pageSize || pageSize)),
                hasMore: data.hasMore || false
            };
        } catch(err) {
            console.error(err);
            throw new Error('Failed to fetch recent chats');
        }
    }

    /**
     * Recent Chats Count
     */
    public async getRecentChatsCount(userId: string): Promise<number> {
        try {
            const res = await fetch(`${this.url}/api/message/messages/recent/${userId}/count`);
            if(!res.ok) throw new Error('Failed to fetch recent chats count');

            const data = await res.json();
            return data.count || 0;
        } catch(err) {
            console.error(err);
            throw new Error('Failed to fetch recent chats count');
        }
    }

    /**
     * Get Message By User Id
     */
    public async getMessagesByUserId(userId: string): Promise<any[]> {
        const res = await fetch(`${this.url}/api/message/messages/userId/${userId}`);
        if(!res.ok) throw new Error('Failed to fetch user messages!');
        return res.json();
    }

    /**
     * Stats
     */
    public async getMessagesStats(): Promise<any[]> {
        const res = await fetch(`${this.url}/api/message/stats`);
        if(!res.ok) throw new Error('Failed to fetch user messages!');
        return res.json();
    }
}