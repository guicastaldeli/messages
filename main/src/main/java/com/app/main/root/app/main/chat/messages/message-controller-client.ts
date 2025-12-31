import { ChatService } from "../chat-service"; 
import { ApiClientController } from "../../_api-client/api-client-controller";
import { SocketClientConnect } from "../../socket-client-connect";
import { MessageServiceClient } from "./message-service-client";

export class MessageControllerClient {
    private chatService: ChatService;
    private socketClientConnect: SocketClientConnect;
    private apiClientController: ApiClientController;
    private messageService: MessageServiceClient;

    constructor(
        socketClientConnect: SocketClientConnect,
        apiClientController: ApiClientController,
        chatService: ChatService
    ) {
        this.socketClientConnect = socketClientConnect;
        this.apiClientController = apiClientController;
        this.chatService = chatService;
        this.messageService = new MessageServiceClient(this.apiClientController.getUrl(), socketClientConnect);
    }

    /**
     * Add Message
     */
    public async addMessage(
        chatId: string, 
        messages: any | any[],
        page: number = 0
    ): Promise<void> {
        const cacheService = await this.chatService.getCacheServiceClient();
        if(!cacheService.cache.has(chatId)) {
            cacheService.init(chatId, 0);
        }

        const data = cacheService.cache.get(chatId)!;
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
        const totalPossiblePages = Math.ceil(estimatedTotal / cacheService.config.pageSize);
        const currentPagesLoaded = data.loadedPages.size;
        
        data.hasMore =
            currentPagesLoaded < totalPossiblePages || 
            (messages.length === cacheService.config.pageSize);
        
        data.isFullyLoaded = 
            !data.hasMore && 
            data.loadedPages.size === totalPossiblePages;
    }

    public async getMessagesPage(data: any, chatId: string, page: number): Promise<any[]> {
        let messagesArray: any[];
        let messageOrder: string[];
        
        if (Array.isArray(data)) {
            messagesArray = data;
            messageOrder = data.map(msg => msg.id || msg.messageId);
        } else if (data && data.messageOrder && Array.isArray(data.messageOrder)) {
            messagesArray = Array.from(data.messages?.values() || []);
            messageOrder = data.messageOrder;
        } else {
            console.warn(`Invalid data format in getMessagesPage - chat: ${chatId}, page: ${page}`, data);
            return [];
        }

        const cacheService = await this.chatService.getCacheServiceClient();
        const startIdx = page * cacheService.config.pageSize;
        const endIdx = Math.min(
            startIdx + cacheService.config.pageSize, 
            messageOrder.length
        );
        
        const messages: any[] = [];
        for(let i = startIdx; i < endIdx; i++) {
            const messageId = messageOrder[i];
            const message = messagesArray.find(msg => (msg.id || msg.messageId) === messageId);
            if(message) messages.push(message);
        }

        return messages;
    }

    public async hasMoreMessages(chatId: string): Promise<boolean> {
        const cacheService = await this.chatService.getCacheServiceClient();
        const data = cacheService.cache.get(chatId);
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

    public async getMessagesWithScroll(
        chatId: string,
        scrollPosition: number,
        containerHeight: number,
        currentMessages: any[]
    ): Promise<{
        messages: any[],
        hasMore: boolean
    }> {
        const cacheService = await this.chatService.getCacheServiceClient();
        cacheService.selectChat(chatId);
        const approxMessageHeight = 80;
        const bufferMessages = 20;

        const startIdx = Math.max(0, Math.floor(scrollPosition / approxMessageHeight) - bufferMessages);
        const endIdx = Math.min(
            await this.getTotalMessages(chatId) - 1,
            startIdx + 
            Math.ceil(containerHeight / approxMessageHeight) + 
            bufferMessages
        );

        const visibleMessages = await this.getMessagesInRange(chatId, startIdx, endIdx);
        const hasMoreMessages = await this.hasMoreMessages(chatId);
        return Promise.resolve({
            messages: visibleMessages,
            hasMore: hasMoreMessages
        });
    }

    /**
     * Get Total Messages
     */
    public async getTotalMessages(chatId: string): Promise<number> {
        const cacheService = await this.chatService.getCacheServiceClient();
        const data = cacheService.cache.get(chatId);
        return data ? data.totalMessagesCount : 0;
    }

    /**
     * Messages in Range
     */
    public async getMessagesInRange(
        chatId: string, 
        start: number, 
        end: number
    ): Promise<any[]> {
        const cacheService = await this.chatService.getCacheServiceClient();
        const data = cacheService.cache.get(chatId);
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
            return timeA - timeB;
        });
    }

    /**
     * Init Cache
     */
    public async initCache(userId: string): Promise<void> {
        try {
            const recentChats = await this.messageService.getRecentMessages(userId, 0, 50);
            const chats = recentChats.chats || [];
            const preloadPromises = chats.map((chat: any) =>
                this.preloadData(chat.id || chat.chatId)
            );
            await Promise.all(preloadPromises);
        } catch(err) {
            console.log('Cache initialization failed: ', err);
            throw err;
        }
    }

    /**
     * Preload Data
     */
    public async preloadData(chatId: string): Promise<void> {
        try {
            const [countData, pageData] = await Promise.all([
                this.messageService.getMessageCountByChatId(chatId),
                this.messageService.getMessagesByChatId(chatId, 0)
            ]);

            const cacheService = await this.chatService.getCacheServiceClient();
            if(!cacheService.cache.has(chatId)) {
                cacheService.init(chatId, countData);
            }
            
            const cacheData = cacheService.cache.get(chatId)!;
            cacheData.messages.clear();
            cacheData.messageOrder = [];
            
            pageData.messages.forEach((msg: any) => {
                const id = msg.id || msg.messageId;
                if (id) {
                    cacheData.messages.set(id, msg);
                    cacheData.messageOrder.push(id);
                }
            });
            
            cacheData.loadedPages.add(0);
            cacheData.totalMessagesCount = countData;
            cacheData.lastAccessTime = Date.now();
            cacheData.hasMore = pageData.hasMore || false;
            cacheData.isFullyLoaded = !cacheData.hasMore;
            cacheData.lastUpdated = Date.now();
            
            console.log(`Preloaded ${pageData.messages.length} messages for chat ${chatId}`);
            
            await this.getMessagesPage(cacheData, chatId, 0);
        } catch(err) {
            console.error(`Preload for ${chatId} failed`, err);
        }
    }

    /**
     * Get Message Service
     */
    public async getMessageService(): Promise<MessageServiceClient >{
        return this.messageService;
    }
}