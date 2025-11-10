import { CacheData, CacheServiceClient } from "@/app/_cache/cache-service-client";
import { MessageManager } from "./message-manager";
import { VisualizerIndexService } from "./visualizer-index-service";
import { ApiClient } from "../_api-client/api-client";

export class ChunkManager {
    private messageManager: MessageManager;
    private cacheService: CacheServiceClient;
    private visualizerIndexService: VisualizerIndexService;
    private apiClient: ApiClient;

    private container: HTMLDivElement;
    private activeChatId: string | null = null;

    constructor(
        messageManager: MessageManager, 
        cacheService: CacheServiceClient,
        apiClient: ApiClient,
        container: HTMLDivElement
    ) {
        this.messageManager = messageManager;
        this.cacheService = cacheService;
        this.container = container;
        this.apiClient = apiClient;
        this.visualizerIndexService = new VisualizerIndexService(this, container);
        this.setupChatChangeListener();
    }
    
    /*
    ** Setup Chat Change Listener
    */
    private setupChatChangeListener(): void {
        window.addEventListener('chat-activated', ((e: CustomEvent) => {
            const { chat } = e.detail;
            if(chat && chat.id !== this.activeChatId) {
                this.activeChatId = chat.id;
                this.visualizerIndexService.resetForChat(chat.id);

                setTimeout(() => {
                    this.visualizerIndexService.setChatContainer();
                }, 100)
            }
        }) as EventListener);
    }

    /*
    ** Preload Pages
    */
    public async preloadPages(chatId: string, currentPage: number): Promise<void> {
        const cacheData = this.cacheService.getCacheData(chatId);
        if(!cacheData) {
            console.error('No cache data');
            return;
        }

        const pages = this.calcPages(currentPage, cacheData);
        for(const page of pages) {
            if(!cacheData.loadedPages.has(page)) {
                try {
                    await this.cacheService.getMessages(chatId, page);
                    console.log(`Strategically preloaded page ${page}`);
                } catch (error) {
                console.error(`Strategic preload failed for page ${page}:`, error);
                }
            }
        }
    }

    /*
    ** Calculate Pages
    */
    private calcPages(currentPage: number, cacheData: CacheData): number[] {
        const pages: number[] = [];
        if(cacheData.hasMore) pages.push(currentPage + 1);

        const boundaryPages = [currentPage + 2, currentPage + 3];
        pages.push(...boundaryPages.filter(page =>
            page * 20 < cacheData.totalMessagesCount
        ));
        return pages;
    }

    /*
    ** Get Visualizer Index Service
    */
    public getVisualizerIndexService(): VisualizerIndexService {
        return this.visualizerIndexService;
    }

    /*
    ** Get Message Manager
    */
    public getMessageManager(): MessageManager {
        return this.messageManager;
    }

    /*
    ** Get Cache Service
    */
    public getCacheService(): CacheServiceClient {
        return this.cacheService;
    }

    /*
    ** Get Api Client
    */
    public getApiClient(): ApiClient {
        return this.apiClient;
    }
}