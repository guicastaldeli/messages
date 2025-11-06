export type ChatType =
'CHAT' |
'SYSTEM' |
'DIRECT' |
'GROUP'; 

export interface Context {
    id: string;
    chatId?: string;
    type: ChatType;
    members: string[];
    metadata?: Record<string, any>;
}

export class ChatRegistry {
    private chats: Map<string, Context> = new Map();
    private currentChat: Context | null = null;

    public getContext(
        type: ChatType,
        members: string[],
        chatId: string
    ): Context {
        let context = this.chats.get(chatId);
        if(!context) {
            context = {
                id: chatId,
                chatId: chatId,
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