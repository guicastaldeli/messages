import { ChatService } from "./chat-service"; 
import { ApiClient } from "../_api-client/api-client";
import { SocketClientConnect } from "../socket-client-connect";
import { MessageServiceClient } from "../_api-client/message-service-client"

export class MessageControllerClient {
    private chatService: ChatService;
    private socketClientConnect: SocketClientConnect;
    private apiClient: ApiClient;
    private messageService: MessageServiceClient;

    constructor(
        socketClientConnect: SocketClientConnect,
        apiClient: ApiClient,
        chatService: ChatService
    ) {
        this.socketClientConnect = socketClientConnect;
        this.apiClient = apiClient;
        this.chatService = chatService;
        this.messageService = new MessageServiceClient(this.apiClient.getUrl(), socketClientConnect);
    }

    /**
     * Add Message
     */
    public addMessage(
        chatId: string, 
        messages: any | any[],
        page: number = 0
    ): void {
        if(!this.chatService.getCacheServiceClient().cache.has(chatId)) {
            this.chatService.getCacheServiceClient().init(chatId, 0);
        }

        const data = this.chatService.getCacheServiceClient().cache.get(chatId)!;
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
        const totalPossiblePages = Math.ceil(estimatedTotal / this.chatService.getCacheServiceClient().config.pageSize);
        const currentPagesLoaded = data.loadedPages.size;
        
        data.hasMore =
            currentPagesLoaded < totalPossiblePages || 
            (messages.length === this.chatService.getCacheServiceClient().config.pageSize);
        
        data.isFullyLoaded = 
            !data.hasMore && 
            data.loadedPages.size === totalPossiblePages;
    }

    public getCachedMessagesPage(data: any, chatId: string, page: number): any[] {
        const startIdx = page * this.chatService.getCacheServiceClient().config.pageSize;
        const endIdx = Math.min(
            startIdx + this.chatService.getCacheServiceClient().config.pageSize, 
            data.messageOrder.length
        );
        const messages: any[] = [];

        for(let i  = startIdx; i < endIdx; i++) {
            const messageId = data.messageOrder[i];
            const message = data.messages.get(messageId);
            if(message) messages.push(message);
        }

        return messages;
    }

    public hasMoreMessages(chatId: string): boolean {
        const data = this.chatService.getCacheServiceClient().cache.get(chatId);
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
        this.chatService.getCacheServiceClient().selectChat(chatId);
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

    /**
     * Get Total Messages
     */
    public getTotalMessages(chatId: string): number {
        const data = this.chatService.getCacheServiceClient().cache.get(chatId);
        return data ? data.totalMessagesCount : 0;
    }

    /**
     * Messages in Range
     */
    public getMessagesInRange(
        chatId: string, 
        start: number, 
        end: number
    ): any[] {
        const data = this.chatService.getCacheServiceClient().cache.get(chatId);
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
     * Get Message Service
     */
    public async getMessageService(): Promise<MessageServiceClient >{
        return this.messageService;
    }
}