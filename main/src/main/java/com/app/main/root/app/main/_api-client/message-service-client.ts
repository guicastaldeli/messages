import { SocketClientConnect } from "../socket-client-connect";

export class MessageServiceClient {
    private baseUrl: string | undefined;
    private socketClient: SocketClientConnect;

    constructor(url: string | undefined, socketClient: SocketClientConnect) {
        this.baseUrl = url;
        this.socketClient = socketClient;
    }

    /*
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
        const res = await fetch(`${this.baseUrl}/api/message-tracker/messages`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        });
        if(!res.ok) throw new Error('Failed to save messages!');
        return res.json();
    }

    /*
    * Tracked Messages
    */
    public async getTrackedMessages(): Promise<any[]> {
        const res = await fetch(`${this.baseUrl}/api/message-tracker/get-messages`);
        if(!res.ok) throw new Error('Failed to fetch tracked messages!');
        return res.json();
    }

    /*
    * Chat Id
    */
   public async getMessagesByChatId(id: string, page: number = 0): Promise<{
        messages: any[];
        currentPage: number;
        pageSize: number;
        totalMessages: number;
        totalPages: number;
        hasMore: boolean
    }> {
        return new Promise(async (res, rej) => {
            const successDestination = '/queue/decrypted-messages-scss';
            const errorDestination = '/queue/decrypted-messages-err';

            const handleSucss = (data: any) => {
                this.socketClient.offDestination(successDestination, handleSucss);
                this.socketClient.offDestination(errorDestination, handleErr);
                res(data);
            };

            const handleErr = (error: any) => {
                this.socketClient.offDestination(successDestination, handleSucss);
                this.socketClient.offDestination(errorDestination, handleErr);
                rej(new Error(error.message || 'Failed to fetch decrypted messages'));
            };

            try {
                this.socketClient.onDestination(successDestination, handleSucss);
                this.socketClient.onDestination(errorDestination, handleErr);
                const payload = {
                    chatId: id,
                    page: page,
                    pageSize: 20
                };

                await this.socketClient.sendToDestination(
                    '/app/get-decrypted-messages',
                    payload,
                    successDestination
                );

            } catch (err) {
                this.socketClient.offDestination(successDestination, handleSucss);
                this.socketClient.offDestination(errorDestination, handleErr);
                rej(err);
            }
        });
    }

    /*
    ** Get Count by Chat Id
    */
    public async getMessageCountByChatId(chatId: string): Promise<number> {
        const res = await fetch(
            `${this.baseUrl}/api/message-tracker/messages/chatId/${chatId}/count`
        );
        if(!res.ok) throw new Error('Failed to fetch messages count');
        
        const data = await res.json();
        return typeof data === 'number' ? data : (data.count || data.total || 0);
    }

    /*
    ** Recent Chats
    */
    public async getRecentChats(
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
            const url = await fetch(
                `${this.baseUrl}/api/message-tracker/messages/recent/${userId}?page=${page}&pageSize=${pageSize}`
            );
            if(!url.ok) throw new Error('Failed to fetch recent chats');
            
            const data = await url.json();
            const res = {
                chats: data,
                currentPage: page,
                pageSize: pageSize,
                totalChats: data.length,
                totalPages: Math.ceil(data.length / pageSize),
                hasMore: true
            }
            return res;
        } catch(err) {
            console.error(err);
            throw new Error('Failed to fetch recent chats');
        }
    }

    /*
    ** Recent Chats Count
    */
    public async getRecentChatsCount(userId: string): Promise<number> {
        try {
            const res = await fetch(`${this.baseUrl}/api/message-tracker/messages/recent/${userId}/count`);
            if(!res.ok) throw new Error('Failed to fetch recent chats count');

            const data = await res.json();
            return data.count || 0;
        } catch(err) {
            console.error(err);
            throw new Error('Failed to fetch recent chats count');
        }
    }

    /*
    * Users
    */
    public async getMessagesByUserId(userId: string): Promise<any[]> {
        const res = await fetch(`${this.baseUrl}/api/message-tracker/messages/userId/${userId}`);
        if(!res.ok) throw new Error('Failed to fetch user messages!');
        return res.json();
    }

    /*
    * Stats
    */
    public async getMessagesStats(): Promise<any[]> {
        const res = await fetch(`${this.baseUrl}/api/message-tracker/stats`);
        if(!res.ok) throw new Error('Failed to fetch user messages!');
        return res.json();
    }
}