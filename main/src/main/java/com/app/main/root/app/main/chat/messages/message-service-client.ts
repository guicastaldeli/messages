import { SocketClientConnect } from "../../socket-client-connect";

export class MessageServiceClient {
    private url: string | undefined;
    private socketClient: SocketClientConnect;

    constructor(url: string | undefined, socketClient: SocketClientConnect) {
        this.url = url;
        this.socketClient = socketClient;
    }

    /**
     * Save Messages
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
            credentials: 'include',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        });
        if(!res.ok) throw new Error('Failed to save messages!');
        return res.json();
    }

    /**
     * Get Tracked Messages
     */
    public async getTrackedMessages(): Promise<any[]> {
        const res = await fetch(`${this.url}/api/message/get-messages`, {
            credentials: 'include'
        });
        if(!res.ok) throw new Error('Failed to fetch tracked messages!');
        return res.json();
    }

    /**
     * Decrypt Message
     */
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
     * Get Message Count by Chat Id
     */
    public async getMessageCountByChatId(chatId: string): Promise<number> {
        const res = await fetch(
            `${this.url}/api/message/messages/chatId/${chatId}/count`,
            {
                credentials: 'include'
            }
        );
        if(!res.ok) throw new Error('Failed to fetch messages count');
        
        const data = await res.json();
        return typeof data === 'number' ? data : (data.count || data.total || 0);
    }

    /**
     * Get Recent Messages
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
                `${this.url}/api/message/messages/recent/${userId}?page=${page}&pageSize=${pageSize}`,
                {
                    credentials: 'include',
                    headers: {
                        'Content-Type': 'application/json'
                    }
                }
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
     * Get Recent Chats Count
     */
    public async getRecentChatsCount(userId: string): Promise<number> {
        try {
            const res = await fetch(`${this.url}/api/message/messages/recent/${userId}/count`, {
                credentials: 'include'
            });
            if(!res.ok) throw new Error('Failed to fetch recent chats count');

            const data = await res.json();
            return data.count || 0;
        } catch(err) {
            console.error(err);
            throw new Error('Failed to fetch recent chats count');
        }
    }

    /**
     * Get Messages By Chat Id
     */
    public async getMessagesByChatId(
        chatId: string,
        page: number = 0,
        pageSize: number = 20
    ): Promise<any[]> {
        const res = await fetch(
            `${this.url}/api/message/messages/chatId/${chatId}?page=${page}&pageSize=${pageSize}`,
            {
                credentials: 'include'
            }
        );
        if(!res.ok) throw new Error('Failed to fetch messages by chat ID');
        return res.json();
    }

    /**
     * Get Messages By User Id
     */
    public async getMessagesByUserId(userId: string): Promise<any[]> {
        const res = await fetch(`${this.url}/api/message/messages/userId/${userId}`, {
            credentials: 'include'
        });
        if(!res.ok) throw new Error('Failed to fetch user messages!');
        return res.json();
    }

    /**
     * Get Messages Stats
     */
    public async getMessagesStats(): Promise<any[]> {
        const res = await fetch(`${this.url}/api/message/stats`, {
            credentials: 'include'
        });
        if(!res.ok) throw new Error('Failed to fetch user messages!');
        return res.json();
    }

    /**
     * Get Messages By Chat Id And User Id
     */
    public async getMessagesByChatIdAndUserId(chatId: string, userId: string): Promise<any[]> {
        const res = await fetch(
            `${this.url}/api/message/messages/chatId/${chatId}/userId/${userId}`,
            {
                credentials: 'include'
            }
        );
        if(!res.ok) throw new Error('Failed to fetch messages by chat ID and user ID');
        return res.json();
    }

    /**
     * Get Messages By Type
     */
    public async getMessagesByType(messageType: string): Promise<any[]> {
        const res = await fetch(
            `${this.url}/api/message/messages/type/${messageType}`,
            {
                credentials: 'include'
            }
        );
        if(!res.ok) throw new Error('Failed to fetch messages by type');
        return res.json();
    }

    /**
     * Delete Message
     */
    public async deleteMessage(messageId: string): Promise<any> {
        const res = await fetch(
            `${this.url}/api/message/messages/${messageId}`,
            {
                method: 'DELETE',
                credentials: 'include'
            }
        );
        if(!res.ok) throw new Error('Failed to delete message');
        return res.json();
    }

    /**
     * Update Message
     */
    public async updateMessage(messageId: string, content: string): Promise<any> {
        const res = await fetch(
            `${this.url}/api/message/messages/${messageId}`,
            {
                method: 'PUT',
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ content })
            }
        );
        if(!res.ok) throw new Error('Failed to update message');
        return res.json();
    }

    /**
     * Get Message History
     */
    public async getMessageHistory(messageId: string): Promise<any[]> {
        const res = await fetch(
            `${this.url}/api/message/messages/${messageId}/history`,
            {
                credentials: 'include'
            }
        );
        if(!res.ok) throw new Error('Failed to fetch message history');
        return res.json();
    }

    /**
     * Pin Message
     */
    public async pinMessage(messageId: string): Promise<any> {
        const res = await fetch(
            `${this.url}/api/message/messages/${messageId}/pin`,
            {
                method: 'POST',
                credentials: 'include'
            }
        );
        if(!res.ok) throw new Error('Failed to pin message');
        return res.json();
    }

    /**
     * Mark Message as Read
     */
    public async markMessageAsRead(messageId: string): Promise<any> {
        const res = await fetch(
            `${this.url}/api/message/messages/${messageId}/read`,
            {
                method: 'POST',
                credentials: 'include'
            }
        );
        if(!res.ok) throw new Error('Failed to mark message as read');
        return res.json();
    }

    /**
     * Mark Messages as Read
     */
    public async markMessagesAsRead(messageIds: string[]): Promise<any> {
        const res = await fetch(
            `${this.url}/api/message/messages/read`,
            {
                method: 'POST',
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ messageIds })
            }
        );
        if(!res.ok) throw new Error('Failed to mark messages as read');
        return res.json();
    }

    /**
     * Get Unread Messages Count
     */
    public async getUnreadMessagesCount(userId: string): Promise<number> {
        const res = await fetch(
            `${this.url}/api/message/messages/unread/count/${userId}`,
            {
                credentials: 'include'
            }
        );
        if(!res.ok) throw new Error('Failed to fetch unread messages count');
        const data = await res.json();
        return data.count || 0;
    }

    /**
     * Get Message Reactions
     */
    public async getMessageReactions(messageId: string): Promise<any[]> {
        const res = await fetch(
            `${this.url}/api/message/messages/${messageId}/reactions`,
            {
                credentials: 'include'
            }
        );
        if(!res.ok) throw new Error('Failed to fetch message reactions');
        return res.json();
    }

    /**
     * Add Reaction
     */
    public async addReaction(messageId: string, reaction: string): Promise<any> {
        const res = await fetch(
            `${this.url}/api/message/messages/${messageId}/reactions`,
            {
                method: 'POST',
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ reaction })
            }
        );
        if(!res.ok) throw new Error('Failed to add reaction');
        return res.json();
    }

    /**
     * Remove Reaction
     */
    public async removeReaction(messageId: string, reaction: string): Promise<any> {
        const res = await fetch(
            `${this.url}/api/message/messages/${messageId}/reactions/${reaction}`,
            {
                method: 'DELETE',
                credentials: 'include'
            }
        );
        if(!res.ok) throw new Error('Failed to remove reaction');
        return res.json();
    }

    /**
     * Get Message Attachments
     */
    public async getMessageAttachments(messageId: string): Promise<any[]> {
        const res = await fetch(
            `${this.url}/api/message/messages/${messageId}/attachments`,
            {
                credentials: 'include'
            }
        );
        if(!res.ok) throw new Error('Failed to fetch message attachments');
        return res.json();
    }

    /**
     * Get Message Metadata
     */
    public async getMessageMetadata(messageId: string): Promise<any> {
        const res = await fetch(
            `${this.url}/api/message/messages/${messageId}/metadata`,
            {
                credentials: 'include'
            }
        );
        if(!res.ok) throw new Error('Failed to fetch message metadata');
        return res.json();
    }

    /**
     * Get Message Analytics
     */
    public async getMessageAnalytics(): Promise<any> {
        const res = await fetch(
            `${this.url}/api/message/messages/analytics`,
            {
                credentials: 'include'
            }
        );
        if(!res.ok) throw new Error('Failed to fetch message analytics');
        return res.json();
    }

    /**
     * Export Messages
     */
    public async exportMessages(chatId: string, format: string = 'json'): Promise<any> {
        const res = await fetch(
            `${this.url}/api/message/messages/export/${chatId}?format=${format}`,
            {
                credentials: 'include'
            }
        );
        if(!res.ok) throw new Error('Failed to export messages');
        return res.json();
    }

    /**
     * Import Messages
     */
    public async importMessages(chatId: string, messages: any[]): Promise<any> {
        const res = await fetch(
            `${this.url}/api/message/messages/import/${chatId}`,
            {
                method: 'POST',
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ messages })
            }
        );
        if(!res.ok) throw new Error('Failed to import messages');
        return res.json();
    }

    /**
     * Clear Chat History
     */
    public async clearChatHistory(chatId: string): Promise<any> {
        const res = await fetch(
            `${this.url}/api/message/messages/chatId/${chatId}/clear`,
            {
                method: 'DELETE',
                credentials: 'include'
            }
        );
        if(!res.ok) throw new Error('Failed to clear chat history');
        return res.json();
    }

    /**
     * Archive Messages
     */
    public async archiveMessages(messageIds: string[]): Promise<any> {
        const res = await fetch(
            `${this.url}/api/message/messages/archive`,
            {
                method: 'POST',
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ messageIds })
            }
        );
        if(!res.ok) throw new Error('Failed to archive messages');
        return res.json();
    }

    /**
     * Restore Messages
     */
    public async restoreMessages(messageIds: string[]): Promise<any> {
        const res = await fetch(
            `${this.url}/api/message/messages/restore`,
            {
                method: 'POST',
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ messageIds })
            }
        );
        if(!res.ok) throw new Error('Failed to restore messages');
        return res.json();
    }

    /**
     * Get Archived Messages
     */
    public async getArchivedMessages(userId: string): Promise<any[]> {
        const res = await fetch(
            `${this.url}/api/message/messages/archived/${userId}`,
            {
                credentials: 'include'
            }
        );
        if(!res.ok) throw new Error('Failed to fetch archived messages');
        return res.json();
    }
}