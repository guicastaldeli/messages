class ApiClient {
    private baseUrl: string;

    constructor() {
        this.baseUrl = process.env.JAVA_API_URL || 'https://localhost:3001';
    }

    async getMessagesByChatId(chatId: string): Promise<any[]> {
        const res = await fetch(`${this.baseUrl}/api/messages?chatId=${chatId}`);
        if(!res.ok) throw new Error('Failed to fetch messages!');
        return res.json();
    }

    async getRecentChats(userId?: string): Promise<any[]> {
        const url = userId
        ? `${this.baseUrl}/api/recent-chats?userId=${userId}`
        : `${this.baseUrl}/api/recent-chats`;
        
        const res = await fetch(url);
        if(!res.ok) throw new Error('Failed to fetch recent chats!');
        return res.json();
    }

    async getUserId(userId: string): Promise<any> {
        const res = await fetch(`${this.baseUrl}/api/users/${userId}`);
        if(!res.ok) throw new Error('Failed to fetch user');
        return res.json();
    }
}

export const apiClient = new ApiClient();