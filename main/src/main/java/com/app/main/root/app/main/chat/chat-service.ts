import { CacheServiceClient } from "../../_cache/cache-service-client";
import { ApiClientController } from "../_api-client/api-client-controller";
import { SocketClientConnect } from "../socket-client-connect";
import { MessageControllerClient } from "./messages/message-controller-client";
import { FileControllerClient } from "./file/file-controller-client";
import { EventStream } from "./event-stream";

export class ChatService {
    private socketClientConnect: SocketClientConnect;
    private apiClientController: ApiClientController;
    private cacheServiceClient: CacheServiceClient;
    private messageControllerClient: MessageControllerClient;
    private fileControllerClient: FileControllerClient;

    constructor(socketClientConnect: SocketClientConnect, apiClientController: ApiClientController) {
        this.socketClientConnect = socketClientConnect;
        this.apiClientController = apiClientController;
        this.cacheServiceClient = CacheServiceClient.getInstance(this, apiClientController);
        this.messageControllerClient = new MessageControllerClient(
            this.socketClientConnect,
            this.apiClientController,
            this
        );
        this.fileControllerClient = new FileControllerClient(
            this.socketClientConnect,
            this.apiClientController,
            this
        );
    }

    public async getChatData(
        userId: string,
        chatId: string,
        page: number = 0,
        pageSize: number = 20
    ): Promise<{
        messages: any[];
        files: any[];
        timeline: any[];
        pagination: {
            page: number;
            pageSize: number;
            totalMessages: number;
            totalFiles: number;
            totalTimeline: number;
            totalPages: number;
            hasMore: boolean;
            fromCache: boolean;
        }
    }> {
        try {
            console.log(`Fetching unified chat data for ${chatId}, page ${page}`);
            
            const res = await fetch(
                `${this.apiClientController.getUrl()}/api/chat/${chatId}/data?userId=${userId}&page=${page}&pageSize=${pageSize}`
            );
            
            if(!res.ok) {
                const errorText = await res.text();
                console.error(`API Error (${res.status}):`, errorText);
                throw new Error(`Failed to fetch chat data! Status: ${res.status}`);
            }

            const resData = await res.json();
            console.log("Unified API response:", resData);
            
            if(resData.success === false) {
                throw new Error(resData.error || 'Failed to fetch chat data');
            }
            
            let messages = [];
            let files = [];
            let timeline = [];
            let pagination = {
                page,
                pageSize,
                totalMessages: 0,
                totalFiles: 0,
                totalTimeline: 0,
                totalPages: 0,
                hasMore: false,
                fromCache: false
            };

            if(resData.data) {
                const data = resData.data;
                messages = Array.isArray(data.messages) ? data.messages : [];
                files = Array.isArray(data.files) ? data.files : [];
                timeline = Array.isArray(data.timeline) ? data.timeline : [];
                
                if(data.pagination) {
                    pagination = {
                        ...pagination,
                        ...data.pagination,
                        totalMessages: data.pagination.totalMessages || data.pagination.total || 0,
                        totalFiles: data.pagination.totalFiles || 0,
                        totalTimeline: data.pagination.totalTimeline || data.pagination.totalItems || 0
                    };
                }
            }

            if(Array.isArray(messages) && messages.length > 0) {
                const decryptedMessages = [];
                for(const message of messages) {
                    try {
                        if(!message.system) {
                            const messageService = await this.getMessageController().getMessageService(); 
                            const decryptedMessage = await messageService.decryptMessage(chatId, message);
                            decryptedMessages.push(decryptedMessage);
                        } else {
                            decryptedMessages.push(message);
                        }
                    } catch (err) {
                        console.error('Failed to decrypt message:', err);
                        decryptedMessages.push(message);
                    }
                }
                messages = decryptedMessages.map((message: any) => ({ ...message }));
            }
            if(Array.isArray(files) && files.length > 0) {
                const decryptedFiles = [];
                for(const file of files) {
                    try {
                        const fileService = await this.getFileController().getFileService(); 
                        const decryptedFile = await fileService.decryptFile(chatId, file);
                        decryptedFiles.push(decryptedFile);
                    } catch (err) {
                        console.error('Failed to decrypt file:', err);
                        decryptedFiles.push(file);
                    }
                }
                files = decryptedFiles.map((file: any) => ({ ...file }));
            }
            if(Array.isArray(timeline) && timeline.length > 0) {
                const decryptedTimeline = [];
                for(const item of timeline) {
                    try {
                        if(item.type === 'message' && !item.system) {
                            const messageService = await this.getMessageController().getMessageService(); 
                            const decryptedItem = await messageService.decryptMessage(chatId, item);
                            decryptedTimeline.push(decryptedItem);
                        } else if(item.type === 'file') {
                            const fileService = await this.getFileController().getFileService(); 
                            const decryptedItem = await fileService.decryptFile(chatId, item.fileData || item);
                            decryptedTimeline.push({
                                ...item,
                                fileData: decryptedItem
                            });
                        } else {
                            decryptedTimeline.push(item);
                        }
                    } catch (err) {
                        console.error('Failed to decrypt timeline item:', err);
                        decryptedTimeline.push(item);
                    }
                }
                timeline = decryptedTimeline;
            }

            return {
                messages,
                files,
                timeline,
                pagination
            };
        } catch (err) {
            console.error(`Failed to fetch chat data for ${chatId}:`, err);
            return {
                messages: [],
                files: [],
                timeline: [],
                pagination: {
                    page,
                    pageSize,
                    totalMessages: 0,
                    totalFiles: 0,
                    totalTimeline: 0,
                    totalPages: 0,
                    hasMore: false,
                    fromCache: false
                }
            };
        }
    }

    public async fetchAndCacheData(
        chatId: string,
        userId: string,
        page: number
    ): Promise<{ 
        messages: any[], 
        files: any[],
        timeline: any[]
    }> {
        try {
            const chatData = await this.getChatData(userId, chatId, page);
            this.addChatDataPage(
                chatId,
                chatData.messages,
                chatData.files,
                chatData.timeline,
                page
            );
            return {
                messages: chatData.messages || [],
                files: chatData.files || [],
                timeline: chatData.timeline || []
            }
        } catch(err) {
            console.error(`Failed to fetch chat data for ${chatId} page ${page}:`, err);
            throw err;
        }
    }

    /**
     * Get Data
     */
    public async getData(
        chatId: string,
        userId: string,
        page: number = 0,
        forceRefresh: boolean = false
    ): Promise<{
        messages: any[],
        files: any[],
        timeline: any[],
        fromCache: boolean
    }> {
        this.cacheServiceClient.selectChat(chatId);
        const cacheKey = `${chatId}_${userId}_${page}`;

        if(!forceRefresh && this.isDataLoaded(chatId, page)) {
            const cachedData = await this.getCachedData(chatId);
            return { 
                messages: cachedData?.messages || [],
                files: cachedData?.files || [],
                timeline: cachedData?.timeline || [],
                fromCache: true 
            }
        }
        if(this.cacheServiceClient.pendingRequests.has(cacheKey)) {
            return this.cacheServiceClient.pendingRequests.get(cacheKey);
        }

        const reqPromise = this.fetchAndCacheData(chatId, userId, page);
        this.cacheServiceClient.pendingRequests.set(cacheKey, reqPromise);
        try {
            const data = await reqPromise;
            return { 
                ...data, 
                timeline: data.timeline || [],
                fromCache: false 
            }
        } finally {
            this.cacheServiceClient.pendingRequests.delete(cacheKey);
        }
    }

    /**
     * Add Chat Data Page
     */
    public addChatDataPage(
        chatId: string,
        messages: any[],
        files: any[],
        timeline: any[],
        page: number = 0
    ): void {
        if(!this.cacheServiceClient.cache.has(chatId)) {
            this.cacheServiceClient.init(
                chatId,
                messages.length + (page * this.cacheServiceClient.config.pageSize),
                files.length + (page * this.cacheServiceClient.config.pageSize),
                timeline.length + (page * this.cacheServiceClient.config.pageSize)
            );

            const data = this.cacheServiceClient.cache.get(chatId)!;

            /* Messages */
            const sortedMessages = messages.sort((a, b) => {
                const tA = a.timestamp || a.createdAt || 0;
                const tB = b.timestamp || b.createdAt || 0;
                return tA - tB;
            });

            const startIndex = page * this.cacheServiceClient.config.pageSize;
            sortedMessages.forEach((m, i) => {
                const id = m.id || m.messageId;
                if(!data.messages.has(id)) {
                    data.messages.set(id, m);
                    const insertIndex = startIndex + i;
                    if(insertIndex >= data.messageOrder.length) {
                        while(data.messageOrder.length < insertIndex) {
                            data.messageOrder.push('');
                        }
                        data.messageOrder.push(id);
                    } else {
                        data.messageOrder[insertIndex] = id;
                    }
                }
            });

            /* Files */
            const sortedFiles = Array.isArray(files) ? files.sort((a, b) => {
                const tA = a.timestamp || a.createdAt || 0;
                const tB = b.timestamp || b.createdAt || 0;
                return tA - tB;
            }) : [];

            const fileStartIndex = page * this.cacheServiceClient.config.pageSize;
            sortedFiles.forEach((f, i) => {
                const fileId = f.file_id || f.id;
                if(!data.files.has(fileId)) {
                    data.files.set(fileId, f);
                    const insertIndex = fileStartIndex + i;
                    if(insertIndex >= data.fileOrder.length) {
                        while(data.fileOrder.length < insertIndex) {
                            data.fileOrder.push('');
                        }
                        data.fileOrder.push(fileId);
                    } else {
                        data.fileOrder[insertIndex] = fileId;
                    }
                }
            });

            /* Timeline */
            if(Array.isArray(timeline)) {
                const sortedTimeline = timeline.sort((a, b) => {
                    const tA = a.timestamp || a.createdAt || 0;
                    const tB = b.timestamp || b.createdAt || 0;
                    return tA - tB;
                });

                const timelineStartIndex = page * this.cacheServiceClient.config.pageSize;
                sortedTimeline.forEach((item, i) => {
                    const id = item.id || item.messageId;
                    if(!data.timeline.has(id)) {
                        data.timeline.set(id, item);
                        const insertIndex = timelineStartIndex + i;
                        if(insertIndex >= data.timelineOrder.length) {
                            while(data.timelineOrder.length < insertIndex) {
                                data.timelineOrder.push('');
                            }
                            data.timelineOrder.push(id);
                        } else {
                            data.timelineOrder[insertIndex] = id;
                        }
                    }
                });
            }

            const time = Date.now();
            data.messageOrder = data.messageOrder.filter(id => id && id !== '');
            data.fileOrder = data.fileOrder.filter(id => id && id !== '');
            data.timelineOrder = data.timelineOrder.filter(id => id && id !== '');
            data.loadedPages.add(page);
            data.loadedFilePages.add(page);
            data.loadedTimelinePages.add(page);
            data.lastAccessTime = time;
            data.lastUpdated = time;
            
            const receivedFullPage = messages.length === this.cacheServiceClient.config.pageSize;
            const receivedFullFilePage = files.length === this.cacheServiceClient.config.pageSize;
            const receivedFullTimelinePage = timeline.length === this.cacheServiceClient.config.pageSize;
            data.hasMore = receivedFullPage;
            data.hasMoreFiles = receivedFullFilePage;
            data.hasMoreTimeline = receivedFullTimelinePage;
            data.totalMessagesCount = Math.max(data.totalMessagesCount, data.messageOrder.length);
            data.totalFilesCount = Math.max(data.totalFilesCount, data.fileOrder.length);
            data.totalTimelineCount = Math.max(data.totalTimelineCount, data.timelineOrder.length);
            data.isFullyLoaded = !data.hasMore && !data.hasMoreFiles && !data.hasMoreTimeline;
        }
    }

    /**
     * Is Data Loaded
     */
    public isDataLoaded(chatId: string, page: number): boolean {
        const data = this.cacheServiceClient.cache.get(chatId);
        return !!data && 
            data.loadedPages.has(page) && 
            data.loadedFilePages.has(page) && 
            data.loadedTimelinePages.has(page);
    }

    /**
     * Get Cached Data
     */
    public async getCachedData(chatId: string): Promise<any> {
        try {
            const cacheService = await this.getCacheServiceClient();
            const cacheData = cacheService.cache.get(chatId);
            if(!cacheData) {
                console.warn(`No cache data found for chat ${chatId}. Available chats:`, Array.from(cacheService.cache.keys()));
                return null;
            }
            
            return cacheData;
        } catch (error) {
            console.error(`Error getting cached data for ${chatId}:`, error);
            return null;
        }
    }

    /**
     * Stream User Chats
     */
    public async streamUserChats(
        userId: string,
        page: number = 0,
        pageSize: number = 20
    ): Promise<EventStream> {
        return new EventStream(
            this.socketClientConnect,
            this, 
        {
            destination: '/app/stream-user-chats',
            payload: { userId, page, pageSize },
            succssDestination: '/queue/user-chats-stream',
            errDestination: '/queue/user-chats-stream-err'
        });
    }

    /**
     * Stream Chat Data
     */
    public async streamChatData(
        chatId: string,
        userId: string,
        page: number = 0,
        pageSize: number = 20,
        includeFiles: boolean = true,
        includeMessages: boolean = true
    ): Promise<EventStream> {
        return new EventStream(
            this.socketClientConnect,
            this,  
        {
            destination: '/app/stream-chat-data',
            payload: { 
                chatId, 
                userId, 
                page, 
                pageSize,
                includeFiles,
                includeMessages 
            },
            succssDestination: '/queue/chat-data-stream',
            errDestination: '/queue/chat-data-stream-err'
        });
    }

    /**
     * Get Cache Service
     */
    public async getCacheServiceClient(): Promise<CacheServiceClient> {
        return this.cacheServiceClient;
    }

    /**
     * Get Message Controller
     */
    public getMessageController(): MessageControllerClient {
        return this.messageControllerClient;
    }

    /**
     * Get File Controller
     */
    public getFileController(): FileControllerClient {
        return this.fileControllerClient;
    }
}