import { CacheServiceClient } from "../../_cache/cache-service-client";
import { ApiClientController } from "../_api-client/api-client-controller";
import { SocketClientConnect } from "../socket-client-connect";
import { MessageControllerClient } from "./messages/message-controller-client";
import { FileControllerClient } from "./file/file-controller-client";

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

    public async fetchAndCacheData(
        chatId: string,
        userId: string,
        page: number
    ): Promise<{ 
        messages: any[], 
        files: any[] 
    }> {
        try {
            const messageService = await this.messageControllerClient.getMessageService();
            const fileService = await this.fileControllerClient.getFileService();

            const msgData = await messageService.getChatData(userId, chatId, page);
            const fileData = await fileService.getChatData(userId, chatId, page);

            this.addChatDataPage(
                chatId,
                msgData.messages,
                fileData.files,
                page
            );
            return {
                messages: msgData.messages || [],
                files: fileData.files || [] 
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
        fromCache: boolean
    }> {
        this.cacheServiceClient.selectChat(chatId);
        const cacheKey = `${chatId}_${userId}_${page}`;

        if(!forceRefresh && this.isDataLoaded(chatId, page)) {
            const cachedData = this.getCachedData(userId, chatId, page);
            return { ...cachedData, fromCache: true }
        }
        if(this.cacheServiceClient.pendingRequests.has(cacheKey)) {
            return this.cacheServiceClient.pendingRequests.get(cacheKey);
        }

        const reqPromise = this.fetchAndCacheData(chatId, userId, page);
        this.cacheServiceClient.pendingRequests.set(cacheKey, reqPromise);
        try {
            const data = await reqPromise;
            return { ...data, fromCache: false }
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
        page: number = 0
    ): void {
        if(!this.cacheServiceClient.cache.has(chatId)) {
            this.cacheServiceClient.init(
                chatId,
                messages.length +
                (page * this.cacheServiceClient.config.pageSize)
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
            const sortedFiles = files.sort((a, b) => {
                const tA = a.timestamp || a.createdAt || 0;
                const tB = b.timestamp || b.createdAt || 0;
                return tA - tB;
            });

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

            const time = Date.now();
            data.messageOrder = data.messageOrder.filter(id => id && id !== '');
            data.fileOrder = data.fileOrder.filter(id => id && id !== '');
            data.loadedPages.add(page);
            data.loadedFilePages.add(page);
            data.lastAccessTime = time;
            data.lastUpdated = time;
            
            const receivedFullPage = messages.length === this.cacheServiceClient.config.pageSize;
            const receivedFullFilePage = files.length === this.cacheServiceClient.config.pageSize;
            data.hasMore = receivedFullPage;
            data.hasMoreFiles = receivedFullFilePage;
            data.totalMessagesCount = Math.max(data.totalMessagesCount, data.messageOrder.length);
            data.totalFilesCount = Math.max(data.totalFilesCount, data.fileOrder.length);
            data.isFullyLoaded = !data.hasMore && !data.hasMoreFiles;
        }
    }

    /**
     * Is Data Loaded
     */
    public isDataLoaded(chatId: string, page: number): boolean {
        const data = this.cacheServiceClient.cache.get(chatId);
        return !!data && data.loadedPages.has(page) && data.loadedFilePages.has(page);
    }

    /**
     * Get Cached Data
     */
    public getCachedData(
        userId: string, 
        chatId: string, 
        page: number = 0
    ): { messages: any[], files: any[] } {
        const data = this.cacheServiceClient.cache.get(chatId)!;
        if(!data) throw new Error('no data!');

        const messages = this.messageControllerClient.getMessagesPage(data, chatId, page);
        const files = this.fileControllerClient.getFilesPage(data, chatId, page);

        return { messages, files }
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