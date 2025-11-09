import { ApiClient } from "../main/_api-client/api-client";
import { CacheServiceClient } from "./cache-service-client";

export class CachePreloaderService {
    private apiClient: ApiClient;
    private cacheService: CacheServiceClient;
    private isPreloading: boolean = false;
    private preloadedChats = new Set<string>();
    private preloadQueue: string[] = [];

    constructor(apiClient: ApiClient, cacheService: CacheServiceClient) {
        this.apiClient = apiClient;
        this.cacheService = cacheService;
        this.setupEventListeners();
    }

    private setupEventListeners(): void {
        if(typeof window === 'undefined') return;
        
        window.addEventListener('chat-item-added', ((e: CustomEvent) => {
            this.schedulePreload(e.detail);
        }) as EventListener);
        window.addEventListener('chat-activated', ((e: CustomEvent) => {
            this.preloadAdjacentChats(e.detail.chatId);
        }) as EventListener);
        window.addEventListener('user-authenticated', ((e: CustomEvent) => {
            this.startPreloading(e.detail.userId);
        }) as EventListener);
    }

    /*
    ** Start Preload
    */
    public async startPreloading(userId: string): Promise<void> {
        if(this.isPreloading) return;
        this.isPreloading = true;
        try {
            await this.preloadRecentChats(userId);
            this.processPreloadQueue();
        } catch(err) {
            console.error('Preloading failed!', err);
        } finally {
            this.isPreloading = false;
        }
    }

    /*
    ** Preload Recent Chats
    */
    private async preloadRecentChats(userId: string): Promise<void> {
        try {
            const service = await this.apiClient.getMessageService();
            const data = await service.getRecentChats(userId, 0, 20);
            const chats = data.chats || [];
            for(const chat of chats) this.schedulePreload(chat);
        } catch(err) {
            console.error('Failed to preload recent chats:', err);
        }
    }

    private schedulePreload(data: any): void {
        const chatId = data.chatId || data.id;
        if(this.preloadedChats.has(chatId)) return;

        const chatType = data.chatType || data.type || 'DIRECT' || 'direct';
        const priority = chatType === 'direct' ? 'normal' : 'high';

        if(priority === 'high') {
            this.preloadQueue.unshift(chatId);
        } else {
            this.preloadQueue.push(chatId);
        }
        this.preloadedChats.add(chatId);
    }

    /*
    ** Process Preload Queue
    */
    private async processPreloadQueue(): Promise<void> {
        while(this.preloadQueue.length > 0) {
            const chatId = this.preloadQueue.shift();
            if(chatId) {
                try {
                    await this.preloadChat(chatId);
                    await new Promise(res => setTimeout(res, 50));
                } catch(err) {
                    console.error(`Failed to preload chat ${chatId}:`, err);
                }
            }
        }
        setTimeout(() => this.processPreloadQueue(), 3000);
    }

    /*
    ** Preload Chat
    */
    private async preloadChat(chatId: string): Promise<void> {
        if(this.cacheService.isChatCached(chatId)) return;
        try {
            const service = await this.apiClient.getMessageService();
            const res = await service.getMessagesByChatId(chatId, 0);
            const messages = res.messages || [];
            if(messages.length >= 0) {
                this.cacheService.init(chatId, messages.length);
                this.cacheService.addMessagesPage(chatId, messages, 0);
                console.log(`Preloaded ${messages.length} messages for ${chatId}`);
            }
        } catch(err) {
            console.error(`Preload failed for ${chatId}:`, err);
        }
    }

    private preloadAdjacentChats(currentChatId: string): void {
        const el = '.chat-item'
        const chatElements = Array.from(document.querySelectorAll(el));
        const currentIndex = chatElements.findIndex(el =>
            el.getAttribute('data-chat-id') === currentChatId
        );

        if(currentIndex !== -1) {
            const nextChats = chatElements.slice(currentIndex + 1, currentIndex + 3);
            nextChats.forEach(el => {
                this.schedulePreload(el);
            });
            const prevChat = chatElements.slice(Math.max(0, currentIndex - 1), currentIndex);
            prevChat.forEach(el => {
                this.schedulePreload(el);
            });
        }
    }

    public getPreloadedStats(): { preloaded: number; queued: number } {
        return {
            preloaded: this.preloadedChats.size,
            queued: this.preloadQueue.length
        }
    }
}   