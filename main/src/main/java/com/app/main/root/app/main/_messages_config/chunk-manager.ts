import { CacheServiceClient } from "@/app/_cache/cache-service-client";
import { MessageManager } from "./message-manager";
import { VizualizerIndexService } from "./visualizer-index-service";

export class ChunkManager {
    private messageManager: MessageManager;
    private cacheService: CacheServiceClient;
    private visualizerIndexService: VizualizerIndexService;
    private container: HTMLDivElement;

    constructor(
        messageManager: MessageManager, 
        cacheService: CacheServiceClient,
        container: HTMLDivElement
    ) {
        this.messageManager = messageManager;
        this.cacheService = cacheService;
        this.container = container;
        this.visualizerIndexService = new VizualizerIndexService(this, container);
    }

    /*
    ** Get Visualizer Index Service
    */
    public getVisualizerIndexService(): VizualizerIndexService {
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
}