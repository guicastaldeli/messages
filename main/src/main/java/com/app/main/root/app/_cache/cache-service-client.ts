import { ApiClientController } from "../main/_api-client/api-client-controller";
import { ChatService } from "../main/chat/chat-service";

export interface CacheConfig {
    pageSize: number;
    maxPages: number;
    preloadPages: number;
    cleanupThreshold: number;
}

export interface CacheData {
    messages: Map<string, any>;
    files: Map<string, any>;
    messageOrder: string[];
    fileOrder: string[];
    loadedPages: Set<number>;
    loadedFilePages: Set<number>;
    totalMessagesCount: number;
    totalFilesCount: number;
    lastAccessTime: number;
    hasMore: boolean;
    hasMoreFiles: boolean;
    isFullyLoaded: boolean;
    lastUpdated: number;
}

export class CacheServiceClient {
    public static instance: CacheServiceClient;
    public apiClientController!: ApiClientController;
    public chatService!: ChatService;

    public cache: Map<string, CacheData> = new Map();
    public accessQueue: string[] = [];
    public pendingRequests: Map<string, Promise<any>> = new Map();
    public evictionListeners: ((chatId: string) => void)[] = [];
    public config: CacheConfig = {
        pageSize: 20,
        maxPages: 100,
        preloadPages: 2,
        cleanupThreshold: 0.8
    }

    public static getInstance(
        chatService: ChatService,
        apiClientController: ApiClientController
    ): CacheServiceClient {
        if (!CacheServiceClient.instance) {
            const instance = new CacheServiceClient();
            instance.apiClientController = apiClientController;
            instance.chatService = chatService;
            CacheServiceClient.instance = instance;
        }

        return CacheServiceClient.instance;
    }


    public init(
        chatId: string, 
        totalMessagesCount: number = 0,
        totalFilesCount: number = 0
    ): void {
        const time = Date.now();
        if (!this.cache.has(chatId)) {
            this.cache.set(chatId, {
                messages: new Map(),
                files: new Map(),
                messageOrder: [],
                fileOrder: [],
                loadedPages: new Set(),
                loadedFilePages: new Set(),
                totalMessagesCount,
                totalFilesCount,
                lastAccessTime: time,
                hasMore: totalMessagesCount > this.config.pageSize,
                hasMoreFiles: totalFilesCount > this.config.pageSize,
                isFullyLoaded: false,
                lastUpdated: time
            });
        }
        this.selectChat(chatId);
    }

    public async initCache(userId: string): Promise<void> {
        this.chatService.getMessageController().initCache(userId);
        this.chatService.getFileController().initCache(userId);
    }

    public setApiClientController(apiClientController: ApiClientController): void {
        this.apiClientController = apiClientController;
    }

    public selectChat(chatId: string): void {
        this.accessQueue = this.accessQueue.filter(id => id !== chatId);
        this.accessQueue.push(chatId);

        const cache = this.cache.get(chatId);
        if(cache) cache.lastAccessTime = Date.now();
    }

    public isChatCached(id: string): boolean {
        return this.cache.has(id);
    }

    public getCacheData(chatId: string): CacheData | undefined {
        return this.cache.get(chatId);
    }

    public addEvictionListener(listener: (chatId: string) => void): void {
        this.evictionListeners.push(listener);
    }

    public removeEvictionListener(listener: (chatId: string) => void): void {
        this.evictionListeners = this.evictionListeners.filter(l => l !== listener);
    }

    public clear(): void {
        this.cache.clear();
        this.accessQueue = [];
        this.pendingRequests.clear();
    }

    public getCachedChats(): string[] {
        return Array.from(this.cache.keys());
    }
}