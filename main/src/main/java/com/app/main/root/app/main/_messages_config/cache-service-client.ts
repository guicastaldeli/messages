import { ApiClient } from "../_api-client/api-client";

interface CacheConfig {
    pageSize: number;
    maxPages: number;
    preloadPages: number;
    maxCachedChats: number;
    cleanupThreshold: number;
}

interface CacheData {
    messages: (any | null)[];
    loadedPages: Set<number>;
    totalMessagesCount: number;
    lastAccessTime: number;
    hasMore: boolean;
    isFullyLoaded: boolean;
    lastUpdated: number;
}

interface PageRequest {
    chatId: string;
    page: number;
    forceRefresh?: boolean;
}

export class CacheServiceClient {
    private static instance: CacheServiceClient;
    private apiClient!: ApiClient;
    private cache: Map<string, CacheData> = new Map();
    private accessQueue: string[] = [];
    private pendingRequests: Map<string, Promise<any>> = new Map();
    private evictionListeners: ((chatId: string) => void)[] = [];
    private config: CacheConfig = {
        pageSize: 100,
        maxPages: 20,
        preloadPages: 2,
        maxCachedChats: 100,
        cleanupThreshold: 0.8
    }

    public static getInstance(): CacheServiceClient {
        if(!CacheServiceClient.instance) {
            CacheServiceClient.instance = new CacheServiceClient;
        }
        return CacheServiceClient.instance;
    }

    public init(chatId: string, totalMessagesCount: number = 0): void {
        const time = Date.now();

        if(!this.cache.has(chatId)) {
            this.cache.set(chatId, {
                messages: [],
                loadedPages: new Set(),
                totalMessagesCount,
                lastAccessTime: time,
                hasMore: totalMessagesCount > this.config.pageSize,
                isFullyLoaded: false,
                lastUpdated: time
            })
        }
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
            const recentChats = messageService.getMessagesByUser(userId);
            const preloadPromises = (await recentChats).map(chat =>
                this.preloadChatData(chat.id, userId)
            );
            await Promise.all(preloadPromises);
        } catch(err) {
            console.log('Cache initialization failed: ', err);
        }
    }

    /*
    ** Preload Data
    */
    private async preloadChatData(chatId: string, userId: string): Promise<void> {
        if(this.cache.has(chatId)) return;
        try {
            const messageService = await this.apiClient.getMessageService();

            const [messages, totalCount] = await Promise.all([
                messageService.getMessagesPage(chatId, 0, this.config.pageSize),
                messageService.getMessageChatCount(chatId)
            ]);

            this.init(chatId, totalCount);
            this.addMessagesPage(chatId, messages, 0);
            this.preloadAdjacentPages(chatId, 0);
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
    ** Fech and Cache Page
    */
    private async fetchAndCachePage(chatId: string, page: number): Promise<any[]> {
        const messages = await this.fetchAndCachePage(chatId, page);
        this.addMessagesPage(chatId, messages, page);
        this.preloadAdjacentPages(chatId, page);
        return messages;
    }

    private preloadAdjacentPages(chatId: string, currentPage: number): void {
        for(let i = 1; i <= this.config.preloadPages; i++) {
            const nextPage = currentPage + i;
            const prevPage = currentPage - i;

            if(!this.isPageLoaded(chatId, nextPage) && this.shouldLoadPage(chatId, nextPage)) {
                this.getMessages(chatId, nextPage).catch(() => { console.log('err') });
            }
            if(prevPage >= 0 && !this.isPageLoaded(chatId, prevPage)) {
                this.getMessages(chatId, prevPage).catch(() => { console.log('err') });
            }
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
        const startIndex = page * this.config.pageSize;

        const reqLength = startIndex + messages.length;
        if(data.messages.length < reqLength) {
            data.messages.push(...Array(reqLength - data.messages.length).fill(null));
        }
        for(let i = 0; i < messages.length; i++) {
            data.messages[startIndex + i] = messages[i];
        }

        const time = Date.now();
        data.loadedPages.add(page);
        data.lastAccessTime = time;
        data.lastUpdated = time;
        data.hasMore = data.messages.length < data.totalMessagesCount;
        data.isFullyLoaded = !data.hasMore && this.allPagesLoaded(chatId);
    }

    /*
    ** Add Message
    */
    public addMessage(chatId: string, message: any): void {
        if(!this.cache.has(chatId)) this.init(chatId, 1);

        const data = this.cache.get(chatId)!;
        const time = Date.now();
        data.messages.push(message);
        data.totalMessagesCount++;
        data.lastUpdated = time;

        const lastPage = Math.floor((data.messages.length - 1) / this.config.pageSize);
        data.loadedPages.add(lastPage);
        this.selectChat(chatId);
    }

    public getVisibleRange(
        chatId: string,
        scrollPosition: number,
        containerHeight: number
    ): {
        start: number,
        end: number
    } {
        const data = this.cache.get(chatId);
        if(!data) return { start: 0, end: 0 }

        const approxMessageHeight = 80;
        const startIdx = Math.max(0, Math.floor(scrollPosition / approxMessageHeight) - 10);
        const endIdx = Math.min(
            data.messages.length - 1,
            startIdx + Math.ceil(containerHeight / approxMessageHeight) + 20
        );

        return { start: startIdx, end: endIdx }
    }

    public async loadMissingPages(
        chatId: string,
        startIndex: number,
        endIndex: number
    ): Promise<void> {
        const startPage = Math.floor(startIndex / this.config.pageSize);
        const endPage = Math.floor(endIndex / this.config.pageSize);
        const loadPromises: Promise<any>[] = [];

        for(let page = startPage; page <= endPage; page++) {
            if(!this.isPageLoaded(chatId, page) && this.shouldLoadPage(chatId, page)) {
                loadPromises.push(this.getMessages(chatId, page));
            }
        }

        await Promise.all(loadPromises);
    }

    private evictChat(chatId: string): void {
        this.cache.delete(chatId);
        this.accessQueue = this.accessQueue.filter(id => id !== chatId);
        this.evictionListeners.forEach(listener => listener(chatId));
    }

    private updateAccessQueue(chatId: string): void {
        this.accessQueue = this.accessQueue.filter(id => id !== chatId);
        this.accessQueue.push(chatId);
        if(this.accessQueue.length > this.config.maxCachedChats * 2) {
            this.accessQueue = this.accessQueue.slice(-this.config.maxCachedChats);
        }
    }

    private selectChat(chatId: string): void {
        const data = this.cache.get(chatId);
        if(data) {
            const time = Date.now();
            data.lastAccessTime = time;
            this.updateAccessQueue(chatId); 
        }
    }

    private isPageComplete(chatId: string, page: number): boolean {
        const data = this.cache.get(chatId);
        if(!data) return false;

        const startIdx = page * this.config.pageSize;
        const endIdx = Math.min(startIdx + this.config.pageSize, data.messages.length);
        for(let i = startIdx; i < endIdx; i++) {
            if(data.messages[i] === null) return false;
        }

        return true;
    }

    private isPageLoaded(chatId: string, page: number): boolean {
        const data = this.cache.get(chatId);
        return !!data && data.loadedPages.has(page) &&
            this.isPageComplete(chatId, page);
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

    private getCachedPage(chatId: string, page: number): any[] {
        const data = this.cache.get(chatId)!;
        const startIdx = page * this.config.pageSize;
        const endIdx = Math.min(startIdx + this.config.pageSize, data.messages.length);
        return data.messages.slice(startIdx, endIdx).filter(msg => msg !== null);
    }


}