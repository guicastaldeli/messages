import { ApiClient } from "../main/_api-client/api-client";

interface CacheConfig {
    pageSize: number;
    maxPages: number;
    preloadPages: number;
    maxCachedChats: number;
    cleanupThreshold: number;
}

export interface CacheData {
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
        pageSize: 20,
        maxPages: 100,
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
            const recentChats = await messageService.getRecentChats(userId, 0, 50);
            const chats = recentChats.chats || [];
            console.log(recentChats.chats)
            const preloadPromises = chats.map(chat =>
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
        console.log('PRELOAD PRELOADPRELOADPRELOADPRELOAD')
        try {
            const messageService = await this.apiClient.getMessageService();

            const [countData, pageData] = await Promise.all([
                messageService.getMessageCountByChatId(chatId),
                messageService.getMessagesByChatId(chatId, 0)
            ]);

            this.init(chatId, countData);
            this.addMessagesPage(chatId, pageData.messages, 0);
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
        try {
            const messageService = await this.apiClient.getMessageService();
            const pageData = await messageService.getMessagesByChatId(chatId, page);
            this.addMessagesPage(chatId, pageData.messages, page);
            this.preloadAdjacentPages(chatId, page);
            return pageData.messages;
        } catch(err) {
            console.error(`Failed to fetch page ${page} for the chat ${chatId}:`, err);
            throw err;
        }
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

        const keysToDelete: string[] = [];
        this.pendingRequests.forEach((_, k) => {
            if(k.startsWith(`${chatId}_`)) {
                keysToDelete.push(k);
            }
        });
        keysToDelete.forEach(k => this.pendingRequests.delete(k));
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

    private cleanup(): void {
        if(this.cache.size <= this.config.maxCachedChats) return;
        const sortedChats = Array.from(this.cache.entries())
            .sort(([,a], [,b]) => a.lastAccessTime - b.lastAccessTime);

        const chatsToRemove = Math.floor(this.cache.size * this.config.cleanupThreshold);
        for(let i = 0; i < chatsToRemove; i++) {
            this.evictChat(sortedChats[i][0]);
        }
    }

    public isChatCached(id: string): boolean {
        return this.cache.has(id);
    }

    private getMessagesInRange(
        chatId: string, 
        start: number, 
        end: number
    ): any[] {
        const data = this.cache.get(chatId);
        if(!data) return [];
        return data.messages.slice(start, end + 1).filter(msg => msg !== null);
    }

    private getTotalMessages(chatId: string): number {
        const data = this.cache.get(chatId);
        return data ? data.totalMessagesCount : 0;
    }

    private hasMoreMessages(chatId: string): boolean {
        const data = this.cache.get(chatId);
        return data ? data.hasMore : false;
    }

    public async getMessagesWithScroll(
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
            startIdx + Math.ceil(containerHeight / approxMessageHeight) +
            bufferMessages
        );

        await this.loadMissingPages(chatId, startIdx, endIdx);
        const visibleMessages = this.getMessagesInRange(chatId, startIdx, endIdx);
        return {
            messages: visibleMessages,
            hasMore: this.hasMoreMessages(chatId)
        }
    }

    public getCacheData(chatId: string): CacheData | undefined {
    return this.cache.get(chatId);
}

}