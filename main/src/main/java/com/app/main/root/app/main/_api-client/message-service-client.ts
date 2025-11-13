export class MessageServiceClient {
    private baseUrl: string | undefined;

    constructor(url: string | undefined) {
        this.baseUrl = url;
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
        const pageSize: number = 20;

        try {
            const res = await fetch(
                `${this.baseUrl}/api/message-tracker/messages/chatId/${id}?page=${page}&pageSize=${pageSize}`
            );
            if(!res.ok) throw new Error('Failed to fetch messages by chat id!');
    
            let data = await res.json();
            let messages = Array.isArray(data) ? data : (data.messages || []);
            messages = messages.map((message: any) => ({
                ...message,
                visualized: false
            }))
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