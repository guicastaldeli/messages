export class MessageServiceClient {
    private baseUrl: string;

    constructor(url: string) {
        this.baseUrl = url;
    }

    /*
    * Tracked Messages
    */
    public async getTrackedMessages(): Promise<any[]> {
        const res = await fetch(`${this.baseUrl}/api/message-tracker/messages`);
        if(!res.ok) throw new Error('Failed to fetch tracked messages!');
        return res.json();
    }

    /*
    * Users
    */
    public async getMessagesByUser(username: string | null): Promise<any[]> {
        const res = await fetch(`${this.baseUrl}/api/message-tracker/messages/user/${username}`);
        if(!res.ok) throw new Error('Failed to fetch user messages!');
        return res.json();
    }

    /*
    * Chat Id
    */
    public async getMessagesByChatId(id: string): Promise<any[]> {
        const res = await fetch(`${this.baseUrl}/api/message-tracker/messages/chat/${id}`);
        if(!res.ok) throw new Error('Failed to fetch messages by chat id!');
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