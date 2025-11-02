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
        try {
            const res = await fetch(`${this.baseUrl}/api/message-tracker/messages/chatId/${id}`);
            if(!res.ok) throw new Error('Failed to fetch messages by chat id!');
    
            const messages = await res.json();
            console.log(`Retrieved ${messages?.length || 0} messages for chat ${id}:`, messages);
            return messages || [];
        } catch(err) {
            console.error(err);
            throw new Error('Failed to fetch messages by chat Id');
        }
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