export class ChatStateManager {
    private emptyChats: Set<string> = new Set();
    private chatMessageCounts: Map<string, number> = new Map();
    private static instance: ChatStateManager;

    private constructor() {
        this.setupEventListeners();
    }

    public static getIntance(): ChatStateManager {
        if(!ChatStateManager.instance) {
            ChatStateManager.instance = new ChatStateManager();
        }
        return ChatStateManager.instance;
    }

    /*
    ** Setup Event Listeners
    */
    private setupEventListeners(): void {
        window.addEventListener('direct-chat-opened', ((e: CustomEvent) => {
            const { chatId } = e.detail;
            if(this.getMessageCount(chatId) === 0) {
                this.markAsEmpty(chatId);
            }
        }) as EventListener);
        window.addEventListener('contact-added', ((e: CustomEvent) => {
            const { chatId } = e.detail;
            this.markAsEmpty(chatId);
        }) as EventListener);
    }

    private markAsEmpty(chatId: string): void {
        this.emptyChats.add(chatId);
    }

    private markChatAsActive(chatId: string): void {
        this.emptyChats.delete(chatId);
    }

    private isChatEmpty(chatId: string): boolean {
        return this.emptyChats.has(chatId);
    }

    /*
    ** Increment Message Count
    */
    public incrementMessageCount(chatId: string): void {
        const currentCount = this.chatMessageCounts.get(chatId) || 0;
        const newCount = currentCount + 1;
        this.chatMessageCounts.set(chatId, newCount);
        if(newCount === 1) {
            this.markChatAsActive(chatId);
            this.triggerChatCreation(chatId);
        }
    }

    public getMessageCount(chatId: string): number {
        return this.chatMessageCounts.get(chatId) || 0;
    }

    public initChatState(chatId: string, messageCount: number): void {
        this.chatMessageCounts.set(chatId, messageCount);
        if(messageCount === 0) {
            this.markAsEmpty(chatId);
        } else {
            this.markChatAsActive(chatId);
        }
    }

    private triggerChatCreation(chatId: string): void {
        const event = new CustomEvent('chat-should-be-created', {
            detail: { chatId }
        });
        window.dispatchEvent(event);
    }

    /*
    ** Reset
    */
    public resetChatState(chatId: string): void {
        this.emptyChats.delete(chatId);
        this.chatMessageCounts.delete(chatId);
    }
}