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
        
        console.log(`[validateCache] Starting validation for ${chatId}: ${cacheData.files.size} files, ${cacheData.timeline.size} timeline items`);
        
        const validFileIds: string[] = [];
        const seenFileKeys = new Set<string>();
        
        cacheData.fileOrder.forEach(fileId => {
            const file = cacheData.files.get(fileId);
            
            if(!file) {
                console.warn(`[validateCache] File ${fileId} in order but not in map`);
                return;
            }
            
            const fileKey = this.getFileKey(file);
            if(seenFileKeys.has(fileKey)) {
                console.warn(`[validateCache] Removing duplicate file: ${fileId} (${fileKey})`);
                cacheData.files.delete(fileId);
            } else {
                seenFileKeys.add(fileKey);
                validFileIds.push(fileId);
            }
        });
        
        cacheData.fileOrder = validFileIds;
        
        const validTimelineIds: string[] = [];
        const seenTimelineKeys = new Set<string>();
        
        cacheData.timelineOrder.forEach(timelineId => {
            const timelineItem = cacheData.timeline.get(timelineId);
            
            if(!timelineItem) {
                console.warn(`[validateCache] Timeline item ${timelineId} in order but not in map`);
                return;
            }
            
            if(timelineItem.type === 'file') {
                const timelineKey = this.getTimelineFileKey(timelineItem);
                if(seenTimelineKeys.has(timelineKey)) {
                    console.warn(`[validateCache] Removing duplicate timeline file: ${timelineId} (${timelineKey})`);
                    cacheData.timeline.delete(timelineId);
                    return;
                }
                seenTimelineKeys.add(timelineKey);
            }
            
            validTimelineIds.push(timelineId);
        });
        
        cacheData.timelineOrder = validTimelineIds;
        
        this.removeOverlappingFiles(cacheData);
        
        console.log(`[validateCache] After cleanup: ${cacheData.files.size} files, ${cacheData.timeline.size} timeline items`);
    }

    private getFileKey(file: any): string {
        const fileId = file.fileId || file.file_id || file.id;
        const timestamp = file.timestamp || file.createdAt || file.uploadedAt || '0';
        const filename = file.originalFileName || file.original_filename || '';
        return `${fileId}_${timestamp}_${filename}`;
    }

    private getTimelineFileKey(timelineItem: any): string {
        if(timelineItem.type !== 'file') return timelineItem.id || timelineItem.messageId;
        
        const fileData = timelineItem.fileData || timelineItem;
        const fileId = fileData.fileId || fileData.file_id || fileData.id;
        const timestamp = timelineItem.timestamp || fileData.timestamp || fileData.createdAt || fileData.uploadedAt || '0';
        const filename = fileData.originalFileName || fileData.original_filename || timelineItem.content || '';
        return `${fileId}_${timestamp}_${filename}`;
    }

    private removeOverlappingFiles(cacheData: CacheData): void {
        const timelineFileKeys = new Set<string>();
        cacheData.timeline.forEach((timelineItem, timelineId) => {
            if(timelineItem.type === 'file') {
                const key = this.getTimelineFileKey(timelineItem);
                timelineFileKeys.add(key);
            }
        });
        
        const filesToRemove: string[] = [];
        cacheData.files.forEach((file, fileId) => {
            const fileKey = this.getFileKey(file);
            if(timelineFileKeys.has(fileKey)) {
                console.warn(`[removeOverlappingFiles] Removing file ${fileId} - already exists in timeline`);
                filesToRemove.push(fileId);
            }
        });
        
        filesToRemove.forEach(fileId => {
            cacheData.files.delete(fileId);
            cacheData.fileOrder = cacheData.fileOrder.filter(id => id !== fileId);
        });
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

    public clearChatCache(chatId: string): void {
        if(this.cache.has(chatId)) {
            this.cache.delete(chatId);
            console.log(`Cache cleared for chat: ${chatId}`);
        }
        
        const keysToDelete = Array.from(this.pendingRequests.keys())
            .filter(key => key.startsWith(`${chatId}_`));
        
        keysToDelete.forEach(key => {
            this.pendingRequests.delete(key);
        });
        
        console.log(`Cleared ${keysToDelete.length} pending requests for ${chatId}`);
    }
}