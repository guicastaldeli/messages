import { MessageManager } from "./message-manager";

export class ChunkRenderer {
    private messageManager: MessageManager;
    private isPreloading: boolean = false;
    private lastScrollTime: number = 0;
    private scrollThrottle: number = 500;
    private currentLoadingPage: number = -1;
    
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
            const now = Date.now();
            if(now - this.lastScrollTime < this.scrollThrottle) return;
            this.lastScrollTime = now;

            const target = e.target as HTMLDivElement;
            const scrollTop = target.scrollTop;
            const distanceFromTop = scrollTop;
            const loadThreshold = 300;

            if(
                distanceFromTop < loadThreshold &&
                !this.messageManager.isLoadingHistory &&
                !this.isPreloading &&
                this.currentLoadingPage === -1
            ) {
                this.loadChunk();
            }
        }

        container.addEventListener('scroll', this.messageManager.scrollHandler);
    }

    /*
    ** Preload Next Page
    */
    public async preloadNextPage(chatId: string, nextPage: number): Promise<void> {
        if(this.isPreloading || this.currentLoadingPage === nextPage) return;

        this.isPreloading = true;
        this.currentLoadingPage = nextPage;

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
            this.messageManager.isLoadingHistory ||
            this.isPreloading ||
            this.currentLoadingPage !== -1
        ) {
            return;
        }

        const nextPage = this.messageManager.currentPage + 1;
        const cacheData = this.messageManager.getCacheService()
            .getCacheData(this.messageManager.currentChatId);
        if(cacheData && cacheData.hasMore) {
            if(cacheData.loadedPages.has(nextPage)) {
                console.log(`Page ${nextPage} already cached, updating current page`);
                this.messageManager.currentPage = nextPage;
                await this.setupScrollHandler();
            } else {
                this.currentLoadingPage = nextPage;
                await this.messageManager.loadHistory(
                    this.messageManager.currentChatId, 
                    nextPage
                );
                this.currentLoadingPage = -1;
            }
        }
    }

    /*
    ** Load Cached Pages
    */
    public async loadCachedPages(chatId: string): Promise<void> {
        const cacheData = this.messageManager.getCacheService().getCacheData(chatId);
        if(!cacheData) return;

        const loadedPages = Array.from(cacheData.loadedPages).sort((a, b) => a - b);
        for (const page of loadedPages) {
            const startIndex = page * 20;
            const endIndex = startIndex + 19;
            const messages = this.messageManager.getCacheService().getMessagesInRange(
                chatId, 
                startIndex, 
                endIndex
            );
            
            if (messages.length > 0) {
                await this.messageManager.getMessageElementRenderer().renderHistory(messages);
            }
        }
        if (loadedPages.length > 0) {
            this.messageManager.currentPage = Math.max(...loadedPages);
        }
    }

    /*
    ** Reset
    */
    public reset(): void {
        this.isPreloading = false;
        this.currentLoadingPage = -1;
        this.lastScrollTime = 0;
    }
}