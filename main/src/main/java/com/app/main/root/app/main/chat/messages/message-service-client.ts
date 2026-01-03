import { SocketClientConnect } from "../../socket-client-connect";

export class MessageServiceClient {
    private url: string | undefined;
    private socketClient: SocketClientConnect;

    constructor(url: string | undefined, socketClient: SocketClientConnect) {
        this.url = url;
        this.socketClient = socketClient;
    }

    /**
     * Get Chat Data
     */
    public async getChatData(
        userId: string,
        chatId: string,
        page: number = 0,
        pageSize: number = 20
    ): Promise<{
        messages: any[];
        pagination: {
            page: number;
            pageSize: number;
            totalMessages: number;
            totalPages: number;
            hasMore: boolean;
            fromCache: boolean;
        }
    }> {
        try {
            const res = await fetch(
                `${this.url}/api/chat/${chatId}/data?userId=${userId}&page=${page}&pageSize=${pageSize}`
            );
            if(!res.ok) {
                const errorText = await res.text();
                console.error(`API Error (${res.status}):`, errorText);
                throw new Error(`Failed to fetch chat data! Status: ${res.status}`);
            }

            const resData = await res.json();
            if(resData.success === false) {
                throw new Error(resData.error || 'Failed to fetch chat data');
            }
            if(resData.data) {
                const data = resData.data;

                if(Array.isArray(data.messages)) {
                    const decryptedMessages = [];

                    for(const message of data.messages) {
                        try {
                            const decryptedMessage = await this.decryptMessage(chatId, message);
                            decryptedMessages.push(decryptedMessage);
                        } catch (err) {
                            if(!message.system) {
                                console.error('Failed to decrypt message:', err);
                            }
                            decryptedMessages.push(message);
                        }
                    }

                    data.messages = decryptedMessages.map(
                        (message: any) => ({ ...message })
                    );
                }

                return data;
            }

            if(resData.messages !== undefined) {
                return resData;
            }

            console.warn('Unexpected response structure:', resData);
            return {
                messages: [],
                pagination: {
                    page,
                    pageSize,
                    totalMessages: 0,
                    totalPages: 0,
                    hasMore: false,
                    fromCache: false
                }
            };
        } catch (err) {
            console.error(`Failed to fetch chat data for ${chatId}:`, err);
            throw err;
        }
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

    /**
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
        const pageSize: number = 20;

        try {
            const res = await fetch(
                `${this.url}/api/message/messages/chatId/${id}?page=${page}&pageSize=${pageSize}`
            );
            if(!res.ok) throw new Error('Failed to fetch messages by chat id!');

            let data = await res.json();
            let messages = Array.isArray(data) ? data : (data.messages || []);
            const decryptedMessages = [];
            for(const message of messages) {
                try {
                    const decryptedMessage = await this.decryptMessage(id, message);
                    decryptedMessages.push(decryptedMessage);
                } catch(err) {
                    if(!message.system) console.error('Failed to decrypt message:', err);
                    decryptedMessages.push(message);
                }
            }
            messages = decryptedMessages.map(
                (message: any) => (
                { ...message }
            ));
            if(Array.isArray(data)) {
                data = messages;
            } else {
                data.messages = messages;
            }

            if(Array.isArray(data)) {
                return {
                    messages: data,
                    currentPage: page,
                    pageSize: pageSize,
                    totalMessages: data.length,
                    totalPages: Math.ceil(data.length / pageSize),
                    hasMore: data.length >= pageSize
                }
            } else {
                return data;
            }
        } catch(err) {
            console.error(err);
            throw new Error('Failed to fetch messages by chat Id');
        }
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
            } catch (err) {
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
    // ...existing code...
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