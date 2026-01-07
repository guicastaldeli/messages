import { ChatController } from "./chat-controller";
import { ChatService } from "./chat-service";

export class ChunkRenderer {
    private chatService: ChatService;
    private chatController: ChatController;

    private isPreloading: boolean = false;
    private lastScrollTime: number = 0;
    private scrollThrottle: number = 500;
    private currentLoadingPage: number = -1;
    
    constructor(chatService: ChatService, chatController: ChatController) {
        this.chatService = chatService;
        this.chatController = chatController;
    }

    /**
     * Setup Scroll Handler
     */
    public async setupScrollHandler(userId: string): Promise<void> {
        const container = await this.chatController.getContainer();
        if(!container) return;

        if(this.chatController.scrollHandler) {
            container.removeEventListener('scroll', this.chatController.scrollHandler);
        }
        this.chatController.scrollHandler = async (e: Event) => {
            const now = Date.now();
            if(now - this.lastScrollTime < this.scrollThrottle) return;
            this.lastScrollTime = now;

            const target = e.target as HTMLDivElement;
            const scrollTop = target.scrollTop;
            const distanceFromTop = scrollTop;
            const loadThreshold = 600;

            if(distanceFromTop < loadThreshold &&
                !this.chatController.isLoadingHistory &&
                !this.isPreloading &&
                this.currentLoadingPage === -1
            ) {
                await this.loadChunk(this.chatController.currentChatId!, userId);
            }
        };

        container.addEventListener('scroll', this.chatController.scrollHandler);
    }

    /**
     * Load Chunk
     */
    public async loadChunk(chatId: string, userId: string): Promise<void> {
        if(!this.chatController.currentChatId || 
            this.chatController.isLoadingHistory ||
            this.isPreloading ||
            this.currentLoadingPage !== -1
        ) {
            console.log('Skipping - conditions not met');
            return;
        }

        const cacheService = await this.chatService.getCacheServiceClient();
        const cacheData = cacheService.getCacheData(chatId);
        if(!cacheData) {
            console.log(`No cache data for chat ${chatId}`);
            return;
        }
        
        const loadedPages = Array.from(cacheData.loadedPages);
        const nextPage = loadedPages.length > 0 ? Math.max(...loadedPages) + 1 : 1;
        
        const totalMessagesExpected = cacheData.totalMessagesCount;
        const messagesPerPage = cacheService.config.pageSize;
        const totalPagesNeeded = Math.ceil(totalMessagesExpected / messagesPerPage);
        
        if(nextPage < totalPagesNeeded) {
            console.log(` Loading page ${nextPage} for chat ${chatId}`);
            this.currentLoadingPage = nextPage;
            
            try {
                const container = await this.chatController.getContainer();
                const oldScrollHeight = container?.scrollHeight || 0;
                await this.chatController.loadHistory(chatId, userId, nextPage);
                
                if(container) {
                    setTimeout(() => {
                        const newScrollHeight = container.scrollHeight;
                        const scrollDiff = newScrollHeight - oldScrollHeight;
                        container.scrollTop = scrollDiff;
                    }, 100);
                }
            } catch(error) {
                console.error(`Failed to load chunk for chat ${chatId}:`, error);
            } finally {
                this.currentLoadingPage = -1;
            }
        } else {
            console.log(`All pages loaded for chat ${chatId}`);
        }
    }

    /**
     * Preload Next Page
     */
    public async preloadNextPage(userId: string, chatId: string, nextPage: number): Promise<void> {
        if(this.isPreloading || this.currentLoadingPage === nextPage) return;
        this.isPreloading = true;
        this.currentLoadingPage = nextPage;

        try {
            const cacheService = await this.chatService.getCacheServiceClient();
            const cacheData = await this.chatService.getCachedData(chatId);
            const data = cacheService.cache.get(chatId)!;
            if(cacheData && data.loadedPages.has(nextPage)) {
                const response = await this.chatService.getChatData(userId, chatId, nextPage);
                if(response.messages && response.messages.length > 0) {
                    this.chatService.getMessageController()
                        .getMessagesPage(
                            response.messages, 
                            chatId, 
                            nextPage
                        );
                }
            }
        } catch(err) {
            console.error(`Failed to preload page ${nextPage}:`, err);
        } finally {
            this.isPreloading = false;
            this.currentLoadingPage = -1;
        }
    }

    /**
     * Load Cached Pages
     */
    public async loadCachedPages(chatId: string): Promise<void> {
        const cacheService = await this.chatService.getCacheServiceClient();
        const cacheData = this.chatService.getCachedData(chatId);
        const data = cacheService.cache.get(chatId)!;
        if(!cacheData || !data) return;

        const loadedPages = Array.from(data.loadedPages).sort((a, b) => a - b);
        for(const page of loadedPages) {
            const startIndex = page * 20;
            const endIndex = startIndex + 19;
            const messages = 
                await this.chatService
                    .getMessageController()
                    .getMessagesInRange(
                        chatId, 
                        startIndex, 
                        endIndex
                    );
            if(messages.length > 0) {
                await this.chatController.getMessageElementRenderer()
                    .renderHistory(messages);
            }
        }
        if(loadedPages.length > 0) {
            this.chatController.currentPage = Math.max(...loadedPages);
        }
    }

    /**
     * Reset
     */
    public reset(): void {
        this.isPreloading = false;
        this.currentLoadingPage = -1;
        this.lastScrollTime = 0;
    }
}