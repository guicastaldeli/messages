export type ChatType =
'DIRECT' |
'GROUP'; 

export interface Context {
    id: string;
    type: ChatType;
    members: string[];
    metadata?: Record<string, any>;
}


export class ChatRegistry {
    private chats: Map<string, Context> = new Map();
    private currentChat: Context | null = null;

    public generateChatId(type: ChatType, members: string[]): string {
        const sortedParticipants = [...members].sort();

        switch(type) {
            case 'DIRECT':
                return `direct_${sortedParticipants.join('_')}`;
            case 'GROUP':
                return members[0];
            default:
                return 'unknown';
        }
    }

    public getContext(
        type: ChatType,
        members: string[],
        metadata?: any
    ): Context {
        const chatId = this.generateChatId(type, members);
        let context = this.chats.get(chatId);
        if(!context) {
            context = {
                id: chatId,
                type: type,
                members: members,
                metadata: members
            }
            this.chats.set(chatId, context);
        }
        return context;
    }

    public setCurrentChat(context: Context): void {
        this.currentChat = context;
    }

    public getCurrentChat(): Context | null {
        return this.currentChat;
    }
}