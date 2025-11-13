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
        this.selectChat(chatId);
    }

    public setApiClient(apiClient: ApiClient): void {
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
    ** Get Messages
    */
    public async getMessages(
        chatId: string,
        page: number = 0,
        forceRefresh: boolean = false
    ): Promise<any[]> {
        this.selectChat(chatId);
        const cacheKey = `${chatId}_${page}`;

        if(!forceRefresh && this.isPageLoaded(chatId, page)) {
            return this.getCachedPage(chatId, page);
        }
        if(this.pendingRequests.has(cacheKey)) {
            return this.pendingRequests.get(cacheKey);
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
    ** Fetch and Cache
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
    ** Add Messages Page
    */
    public addMessagesPage(
        chatId: string, 
        messages: any[], 
        page: number = 0
    ): void {
        if(!this.cache.has(chatId)) {
            this.init(
                chatId, 
                messages.length + 
                (page * this.config.pageSize)
            );
        }
        
        const data = this.cache.get(chatId)!;
        const sortedMessages = messages.sort((a, b) => {
            const timeA = a.timestamp || a.createdAt || 0;
            const timeB = b.timestamp || b.createdAt || 0;
            return timeB - timeA;
        });
        const startIndex = page * this.config.pageSize;

        sortedMessages.forEach((m, i) => {
            const id = m.id || m.messageId;
            if(!data.messages.has(id)) {
                data.messages.set(id, m);
                const insertIndex = startIndex + i;
            
                if (insertIndex >= data.messageOrder.length) {
                    while (data.messageOrder.length < insertIndex) {
                        data.messageOrder.push('');
                    }
                    data.messageOrder.push(id);
                } else {
                    data.messageOrder[insertIndex] = id;
                }
            }
        });

        const time = Date.now();
        data.messageOrder = data.messageOrder.filter(id => id && id !== '');
        data.loadedPages.add(page);
        data.lastAccessTime = time;
        data.lastUpdated = time;
        
        const receivedFullPage = messages.length === this.config.pageSize;
        data.hasMore = receivedFullPage;
        data.totalMessagesCount = Math.max(data.totalMessagesCount, data.messageOrder.length);
        data.isFullyLoaded = !data.hasMore;
    }

    /*
    ** Add Message
    */
    public addMessage(
        chatId: string, 
        messages: any | any[],
        page: number = 0
    ): void {
        if(!this.cache.has(chatId)) {
            this.init(chatId, 0);
        }

        const data = this.cache.get(chatId)!;
        const messageArray = Array.isArray(messages) ? messages : [messages];
        messageArray.forEach((m: any) => {
            const id = m.id || m.messageId;
            if(!data.messages.has(id)) {
                data.messages.set(id, m);
                data.messageOrder.push(id);
            }
        });

        const time = Date.now();
        data.messageOrder = data.messageOrder.filter(id => id && data.messages.has(id));
        data.loadedPages.add(page);
        data.lastAccessTime = time;
        data.lastUpdated = time;
        const totalMessagesKnown = data.messageOrder.length;
        const estimatedTotal = Math.max(data.totalMessagesCount, totalMessagesKnown);
        const totalPossiblePages = Math.ceil(estimatedTotal / this.config.pageSize);
        const currentPagesLoaded = data.loadedPages.size;
        
        data.hasMore =
            currentPagesLoaded < totalPossiblePages || 
            (messages.length === this.config.pageSize);
        
        data.isFullyLoaded = 
            !data.hasMore && 
            data.loadedPages.size === totalPossiblePages;
    }

    /*
    ** Messages in Range
    */
     public getMessagesInRange(
        chatId: string, 
        start: number, 
        end: number
    ): any[] {
        const data = this.cache.get(chatId);
        if(!data) return [];

        const result: any[] = [];
        const endIndex = Math.min(end, data.messageOrder.length - 1);
        for(let i = start; i <= endIndex; i++) {
            const id = data.messageOrder[i];
            const message = data.messages.get(id);
            if(message) result.push({ ...message, virtualIndex: i });
        }
        
        return result.sort((a, b) => {
            const timeA = a.timestamp || a.createdAt || 0;
            const timeB = b.timestamp || b.createdAt || 0;
            return timeB - timeA;
        });
    }


    /*
    ** Get Total Messages
    */
    public getTotalMessages(chatId: string): number {
        const data = this.cache.get(chatId);
        return data ? data.totalMessagesCount : 0;
    }

    /*
    ** Is Page Loaded
    */
    private isPageLoaded(chatId: string, page: number): boolean {
        const data = this.cache.get(chatId);
        return !!data && data.loadedPages.has(page);
    }

    /*
    ** Get Cached Page
    */
    private getCachedPage(chatId: string, page: number): any[] {
        const data = this.cache.get(chatId)!;
        const startIdx = page * this.config.pageSize;
        const endIdx = Math.min(startIdx + this.config.pageSize, data.messageOrder.length);
        
        const result: any[] = [];
        for(let i = startIdx; i < endIdx; i++) {
            const messageId = data.messageOrder[i];
            const message = data.messages.get(messageId);
            if(message) result.push(message);
        }
        return result.sort((a, b) => {
            const timeA = a.timestamp || a.createdAt || 0;
            const timeB = b.timestamp || b.createdAt || 0;
            return timeB - timeA;
        });
    }

    private selectChat(chatId: string): void {
        this.accessQueue = this.accessQueue.filter(id => id !== chatId);
        this.accessQueue.push(chatId);
    }

    public isChatCached(id: string): boolean {
        return this.cache.has(id);
    }

    public hasMoreMessages(chatId: string): boolean {
        const data = this.cache.get(chatId);
        if(!data) return false;
        if(data.isFullyLoaded) return false;
        if(data.hasMore) return true;

        const estimatedTotalMessages = Math.max(
            data.totalMessagesCount, 
            data.messageOrder.length
        );
        const loadedCount = data.messageOrder.length;
        return loadedCount < estimatedTotalMessages;
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
        this.selectChat(chatId);
        const approxMessageHeight = 80;
        const bufferMessages = 20;

        const startIdx = Math.max(0, Math.floor(scrollPosition / approxMessageHeight) - bufferMessages);
        const endIdx = Math.min(
            this.getTotalMessages(chatId) - 1,
            startIdx + 
            Math.ceil(containerHeight / approxMessageHeight) + 
            bufferMessages
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

    public clear(): void {
        this.cache.clear();
        this.accessQueue = [];
        this.pendingRequests.clear();
    }

    public getCachedChats(): string[] {
        return Array.from(this.cache.keys());
    }
}