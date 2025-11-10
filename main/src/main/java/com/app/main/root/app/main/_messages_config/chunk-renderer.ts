import { MessageManager } from "./message-manager";

export class ChunkRenderer {
    private messageManager: MessageManager;
    
    constructor(messageManager: MessageManager) {
        this.messageManager = messageManager;
    }
    /*
    ** Setup Scroll Handler
    */
    public async setupScrollHandler(): Promise<void> {
        const container = await this.messageManager.getContainer();
        if(!container) return;

        this.messageManager.scrollHandler = (e: Event) => {
            const target = e.target as HTMLDivElement;
            const scrollTop = target.scrollTop;
            if(scrollTop < 100 && !this.messageManager.isLoadingHistory) {
                this.loadChunk();
            }
        }

        container.addEventListener('scroll', this.messageManager.scrollHandler);
    }

    /*
    ** Preload Next Page
    */
    public async preloadNextPage(chatId: string, nextPage: number): Promise<void> {
        try {
            const cacheData = this.messageManager.getCacheService().getCacheData(chatId);
            if(cacheData && !cacheData.loadedPages.has(nextPage)) {
                const messageService = await this.messageManager.getApiClient().getMessageService();
                const response = await messageService.getMessagesByChatId(chatId, nextPage);
                if(response.messages && response.messages.length > 0) {
                    this.messageManager.getCacheService()
                        .addMessagesPage(chatId, response.messages, nextPage);
                }
            }
        } catch(err) {
            console.error(`Failed to preload page ${nextPage}:`, err);
        }
    }

    /*
    ** Load Chunk
    */
    public async loadChunk(): Promise<void> {
        if(
            !this.messageManager.currentChatId || 
            this.messageManager.isLoadingHistory
        ) return;

        const nextPage = this.messageManager.currentPage + 1;
        const cacheData = this.messageManager.getCacheService()
            .getCacheData(this.messageManager.currentChatId);
        if(cacheData && cacheData.hasMore) {
            await this.messageManager.loadHistory(
                this.messageManager.currentChatId, nextPage
            );
        }
    }
}