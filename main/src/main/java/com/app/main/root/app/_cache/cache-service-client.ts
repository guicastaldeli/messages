import { ApiClient } from "../main/_api-client/api-client";

export interface CacheConfig {
    pageSize: number;
    maxPages: number;
    preloadPages: number;
    maxCachedChats: number;
    cleanupThreshold: number;
}

export interface CacheData {
    messages: Map<string, any>;
    messageOrder: string[];
    loadedPages: Set<number>;
    totalMessagesCount: number;
    lastAccessTime: number;
    hasMore: boolean;
    isFullyLoaded: boolean;
    lastUpdated: number;
}

export class CacheServiceClient {
    private static instance: CacheServiceClient;
    private apiClient!: ApiClient;
    private cache: Map<string, CacheData> = new Map();
    private accessQueue: string[] = [];
    private pendingRequests: Map<string, Promise<any>> = new Map();
    private evictionListeners: ((chatId: string) => void)[] = [];
    private config: CacheConfig = {
        pageSize: 20,
        maxPages: 100,
        preloadPages: 2,
        maxCachedChats: 10,
        cleanupThreshold: 0.8
    }

    public static getInstance(): CacheServiceClient {
        if(!CacheServiceClient.instance) {
            CacheServiceClient.instance = new CacheServiceClient();
        }
        return CacheServiceClient.instance;
    }

    public init(chatId: string, totalMessagesCount: number = 0): void {
        const time = Date.now();

        if(!this.cache.has(chatId)) {
            this.cache.set(chatId, {
                messages: new Map(),
                messageOrder: [],
                loadedPages: new Set(),
                totalMessagesCount,
                lastAccessTime: time,
                hasMore: totalMessagesCount > this.config.pageSize,
                isFullyLoaded: false,
                lastUpdated: time
            });
        }
        this.touchChat(chatId);
    }

    public setApi(apiClient: ApiClient): void {
        this.apiClient = apiClient;
    }

    /*
    ** Init Cache
    */
    public async initCache(userId: string): Promise<void> {
        try {
            const messageService = await this.apiClient.getMessageService();
            const recentChats = await messageService.getRecentChats(userId, 0, 50);
            const chats = recentChats.chats || [];
            const preloadPromises = chats.map((chat: any) =>
                this.preloadChatData(chat.id || chat.chatId)
            );
            await Promise.all(preloadPromises);
        } catch(err) {
            console.log('Cache initialization failed: ', err);
            throw err;
        }
    }

    /*
    ** Preload Data
    */
    private async preloadChatData(chatId: string): Promise<void> {
        try {
            const messageService = await this.apiClient.getMessageService();

            const [countData, pageData] = await Promise.all([
                messageService.getMessageCountByChatId(chatId),
                messageService.getMessagesByChatId(chatId, 0)
            ]);

            this.init(chatId, countData);
            this.addMessagesPage(chatId, pageData.messages, 0);
        } catch(err) {
            console.error(`Preload for ${chatId} failed`, err);
        }
    }

    /*
    ** Get Messages - OPTIMIZED
    */
    public async getMessages(
        chatId: string,
        page: number = 0,
        forceRefresh: boolean = false
    ): Promise<any[]> {
        this.touchChat(chatId);
        const cacheKey = `${chatId}_${page}`;

        if(!forceRefresh && this.isPageLoaded(chatId, page)) {
            return this.getCachedPage(chatId, page);
        }
        if(this.pendingRequests.has(cacheKey)) {
            return this.pendingRequests.get(cacheKey)!;
        }

        const requestPromise = this.fetchAndCachePage(chatId, page);
        this.pendingRequests.set(cacheKey, requestPromise);
        try {
            const messages = await requestPromise;
            return messages;
        } finally {
            this.pendingRequests.delete(cacheKey);
        }
    }

    /*
    ** Fetch and Cache Page
    */
    private async fetchAndCachePage(chatId: string, page: number): Promise<any[]> {
        try {
            const messageService = await this.apiClient.getMessageService();
            const pageData = await messageService.getMessagesByChatId(chatId, page);
            this.addMessagesPage(chatId, pageData.messages, page);
            return pageData.messages;
        } catch(err) {
            console.error(`Failed to fetch page ${page} for the chat ${chatId}:`, err);
            throw err;
        }
    }

    /*
    ** Add Messages Page - OPTIMIZED with Map
    */
    public addMessagesPage(
    chatId: string, 
    messages: any[], 
    page: number = 0
): void {
    if(!this.cache.has(chatId)) {
        this.init(
            chatId, 
            messages.length + (page * this.config.pageSize)
        );
    }
    
    const data = this.cache.get(chatId)!;
    
    // Add messages to Map and maintain order
    messages.forEach((message, index) => {
        const messageId = message.id || message.messageId;
        if (!data.messages.has(messageId)) {
            data.messages.set(messageId, message);
            
            // Calculate position in the overall message order
            const position = (page * this.config.pageSize) + index;
            
            // Ensure the array is large enough
            while (data.messageOrder.length <= position) {
                data.messageOrder.push('');
            }
            
            // Insert at correct position
            data.messageOrder[position] = messageId;
        }
    });

    // Clean up any empty slots
    data.messageOrder = data.messageOrder.filter(id => id !== '');

    const time = Date.now();
    data.loadedPages.add(page);
    data.lastAccessTime = time;
    data.lastUpdated = time;
    
    // Update total count if this page reveals more messages
    const revealedCount = (page * this.config.pageSize) + messages.length;
    if (revealedCount > data.totalMessagesCount) {
        data.totalMessagesCount = revealedCount;
    }
    
    data.hasMore = data.messages.size < data.totalMessagesCount;
    data.isFullyLoaded = !data.hasMore && this.allPagesLoaded(chatId);
    
    this.enforceMemoryLimits(chatId);
    
    console.log(`Added page ${page} to cache. Total messages: ${data.messages.size}, Has more: ${data.hasMore}`);
}

    /*
    ** Add Message - OPTIMIZED
    */
    public addMessage(chatId: string, message: any): void {
        if(!this.cache.has(chatId)) this.init(chatId, 1);

        const data = this.cache.get(chatId)!;
        const time = Date.now();
        const messageId = message.id || message.messageId;
        
        if (!data.messages.has(messageId)) {
            data.messages.set(messageId, message);
            data.messageOrder.push(messageId);
            data.totalMessagesCount++;
            data.lastUpdated = time;
            this.touchChat(chatId);
        }
    }

    /*
    ** Get messages in range for virtualization - NEW METHOD
    */
    public getMessagesInRange(
        chatId: string, 
        start: number, 
        end: number
    ): any[] {
        const data = this.cache.get(chatId);
        if(!data) return [];
        
        const result: any[] = [];
        for (let i = start; i <= Math.min(end, data.messageOrder.length - 1); i++) {
            const messageId = data.messageOrder[i];
            const message = data.messages.get(messageId);
            if (message) {
                result.push({ ...message, virtualIndex: i });
            }
        }
        return result;
    }

    /*
    ** Get total messages count
    */
    public getTotalMessages(chatId: string): number {
        const data = this.cache.get(chatId);
        return data ? data.totalMessagesCount : 0;
    }

    /*
    ** Check if page is loaded
    */
    private isPageLoaded(chatId: string, page: number): boolean {
        const data = this.cache.get(chatId);
        return !!data && data.loadedPages.has(page);
    }

    /*
    ** Get cached page
    */
    private getCachedPage(chatId: string, page: number): any[] {
        const data = this.cache.get(chatId)!;
        const startIdx = page * this.config.pageSize;
        const endIdx = Math.min(startIdx + this.config.pageSize, data.messageOrder.length);
        
        const result: any[] = [];
        for (let i = startIdx; i < endIdx; i++) {
            const messageId = data.messageOrder[i];
            const message = data.messages.get(messageId);
            if (message) {
                result.push(message);
            }
        }
        return result;
    }

    /*
    ** Memory management
    */
    private enforceMemoryLimits(chatId: string): void {
        const data = this.cache.get(chatId);
        if (!data) return;

        const maxMessages = 500;
        if (data.messages.size > maxMessages) {
            // Remove oldest messages
            const messagesToRemove = data.messages.size - maxMessages;
            for (let i = 0; i < messagesToRemove; i++) {
                const oldestMessageId = data.messageOrder[i];
                data.messages.delete(oldestMessageId);
            }
            data.messageOrder = data.messageOrder.slice(messagesToRemove);
            data.totalMessagesCount = data.messages.size;
        }
    }

    private touchChat(chatId: string): void {
        this.accessQueue = this.accessQueue.filter(id => id !== chatId);
        this.accessQueue.push(chatId);
        
        if (this.accessQueue.length > this.config.maxCachedChats) {
            const toRemove = this.accessQueue.shift();
            if (toRemove) {
                this.cache.delete(toRemove);
                this.evictionListeners.forEach(listener => listener(toRemove));
            }
        }
    }

    private allPagesLoaded(chatId: string): boolean {
        const data = this.cache.get(chatId);
        if(!data) return false;

        const totalPages = Math.ceil(data.totalMessagesCount / this.config.pageSize);
        for(let page = 0; page < totalPages; page++) {
            if(!this.isPageLoaded(chatId, page)) return false;
        }

        return true;
    }

    private shouldLoadPage(chatId: string, page: number): boolean {
        const data = this.cache.get(chatId);
        if(!data) return false;

        const totalPages = Math.ceil(data.totalMessagesCount / this.config.pageSize);
        return page >= 0 && page < totalPages;
    }

    public isChatCached(id: string): boolean {
        return this.cache.has(id);
    }

    public hasMoreMessages(chatId: string): boolean {
        const data = this.cache.get(chatId);
        return data ? data.hasMore : false;
    }

    public getMessagesWithScroll(
        chatId: string,
        scrollPosition: number,
        containerHeight: number,
        currentMessages: any[]
    ): Promise<{
        messages: any[],
        hasMore: boolean
    }> {
        this.touchChat(chatId);
        const approxMessageHeight = 80;
        const bufferMessages = 20;

        const startIdx = Math.max(0, Math.floor(scrollPosition / approxMessageHeight) - bufferMessages);
        const endIdx = Math.min(
            this.getTotalMessages(chatId) - 1,
            startIdx + Math.ceil(containerHeight / approxMessageHeight) + bufferMessages
        );

        const visibleMessages = this.getMessagesInRange(chatId, startIdx, endIdx);
        return Promise.resolve({
            messages: visibleMessages,
            hasMore: this.hasMoreMessages(chatId)
        });
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

    public debugCacheState(chatId: string): void {
        const data = this.cache.get(chatId);
        if (!data) {
            console.log(`No cache data for ${chatId}`);
            return;
        }
        
        console.log(`=== CACHE STATE for ${chatId} ===`);
        console.log(`Total messages: ${data.messages.size}`);
        console.log(`Message order length: ${data.messageOrder.length}`);
        console.log(`Loaded pages: ${Array.from(data.loadedPages).sort((a, b) => a - b)}`);
        console.log(`Total messages count: ${data.totalMessagesCount}`);
        console.log(`Has more: ${data.hasMore}`);
        console.log(`Is fully loaded: ${data.isFullyLoaded}`);
        console.log(`===================`);
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