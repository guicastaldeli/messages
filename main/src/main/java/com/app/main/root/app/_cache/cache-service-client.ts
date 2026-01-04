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
    timeline: Map<string, any>;
    messageOrder: string[];
    fileOrder: string[];
    timelineOrder: string[];
    loadedPages: Set<number>;
    loadedFilePages: Set<number>;
    loadedTimelinePages: Set<number>;
    totalMessagesCount: number;
    totalFilesCount: number;
    totalTimelineCount: number;
    lastAccessTime: number;
    hasMore: boolean;
    hasMoreFiles: boolean;
    hasMoreTimeline: boolean;
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
        if(!CacheServiceClient.instance) {
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
        totalFilesCount: number = 0,
        totalTimelineCount: number = 0
    ): void {
        const time = Date.now();
        if(!this.cache.has(chatId)) {
            this.cache.set(chatId, {
                messages: new Map(),
                files: new Map(),
                timeline: new Map(),
                messageOrder: [],
                fileOrder: [],
                timelineOrder: [],
                loadedPages: new Set(),
                loadedFilePages: new Set(),
                loadedTimelinePages: new Set(),
                totalMessagesCount,
                totalFilesCount,
                totalTimelineCount,
                lastAccessTime: time,
                hasMore: totalMessagesCount > this.config.pageSize,
                hasMoreFiles: totalFilesCount > this.config.pageSize,
                hasMoreTimeline: totalTimelineCount > this.config.pageSize,
                isFullyLoaded: false,
                lastUpdated: time
            });
        }
        this.selectChat(chatId);
    }

    public async initCache(userId: string, activeChat?: string): Promise<void> {
        this.chatService.getMessageController().initCache(userId);
        this.chatService.getFileController().initCache(userId, activeChat);
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

    public validateCache(chatId: string): void {
        const cacheData = this.cache.get(chatId);
        if(!cacheData) return;
        
        let removedCount = 0;
        const validMessageIds: string[] = [];
        const validTimelineIds: string[] = [];
        
        cacheData.messageOrder.forEach(messageId => {
            const message = cacheData.messages.get(messageId);
            
            if(!message) {
                console.warn(`[validateCache] Message ${messageId} in order but not in map`);
                return;
            }
            
            const messageChatId = message.chatId;
            
            if(messageChatId && messageChatId !== chatId) {
                console.warn(`[validateCache] Removing message ${messageId} from ${chatId} - belongs to ${messageChatId}`);
                cacheData.messages.delete(messageId);
                removedCount++;
            } else {
                if(!message.chatId) {
                    message.chatId = chatId;
                }
                validMessageIds.push(messageId);
            }
        });

        cacheData.timelineOrder.forEach(timelineId => {
            const timelineItem = cacheData.timeline.get(timelineId);
            
            if(!timelineItem) {
                console.warn(`[validateCache] Timeline item ${timelineId} in order but not in map`);
                return;
            }
            
            const timelineChatId = timelineItem.chatId;
            
            if(timelineChatId && timelineChatId !== chatId) {
                console.warn(`[validateCache] Removing timeline item ${timelineId} from ${chatId} - belongs to ${timelineChatId}`);
                cacheData.timeline.delete(timelineId);
                removedCount++;
            } else {
                if(!timelineItem.chatId) {
                    timelineItem.chatId = chatId;
                }
                validTimelineIds.push(timelineId);
            }
        });

        cacheData.messageOrder = validMessageIds;
        cacheData.timelineOrder = validTimelineIds;
        
        if(removedCount > 0) {
            console.log(`[validateCache] Cleaned ${removedCount} invalid items from ${chatId}`);
            console.log(`[validateCache] ${cacheData.messages.size} valid messages, ${cacheData.timeline.size} valid timeline items remain`);
        }
    }

    /**
     * Validate All Caches
     */
    public validateAllCaches(): void {
        console.log('[validateAllCaches] Starting cache validation...');
        this.cache.forEach((_, chatId) => {
            this.validateCache(chatId);
        });
        console.log('[validateAllCaches] Cache validation complete');
    }
}