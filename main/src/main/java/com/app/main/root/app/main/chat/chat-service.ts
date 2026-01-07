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
            
            // FIX: Ensure files are included for newly added users
            if(files.length === 0 && timeline.length > 0) {
                // Extract files from timeline
                const timelineFiles = timeline.filter((item: any) => item.type === 'file');
                if(timelineFiles.length > 0) {
                    console.log(`Extracting ${timelineFiles.length} files from timeline`);
                    files = timelineFiles.map((item: any) => item.fileData || item);
                }
            }
            
            if(data.pagination) {
                pagination = {
                    ...pagination,
                    ...data.pagination,
                    totalMessages: data.pagination.totalMessages || data.pagination.total || 0,
                    totalFiles: data.pagination.totalFiles || files.length, // Use actual files count
                    totalTimeline: data.pagination.totalTimeline || data.pagination.totalItems || 0
                };
            }
        }

            /* Messages */
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
                    } catch(err) {
                        console.error('Failed to decrypt message:', err);
                        decryptedMessages.push(message);
                    }
                }
                messages = decryptedMessages.map((message: any) => ({ ...message }));
            }
            /* Files */
            if(Array.isArray(files) && files.length > 0) {
                const decryptedFiles = [];
                const chunkSize = 5;
                for(let i = 0; i < files.length; i += chunkSize) {
                    const chunk = files.slice(i, i + chunkSize);
                    const chunkPromises = chunk.map(async (file) => {
                        try {
                            const fileService = await this.getFileController().getFileService(); 
                            const fileArray = Array.isArray(file) ? file : [file];
                            const decryptedFileArray = await fileService.decryptFile(chatId, fileArray);
                            return decryptedFileArray && decryptedFileArray.length > 0 ? decryptedFileArray[0] : file;
                        } catch(err) {
                            console.error('Failed to decrypt file:', err);
                            return file; 
                        }
                    });
                    
                    const chunkResults = await Promise.all(chunkPromises);
                    decryptedFiles.push(...chunkResults);
                    
                    if(i + chunkSize < files.length) {
                        await new Promise(resolve => setTimeout(resolve, 100));
                    }
                }
                files = decryptedFiles.map((file: any) => ({ ...file }));
            }
            if(Array.isArray(files) && files.length > 0) {
                const timelineFileIds = new Set(
                    timeline
                        .filter((item: any) => item.type === 'file')
                        .map((item: any) => item.fileData?.fileId || item.fileId || item.id)
                );
                
                console.log(`Timeline has ${timelineFileIds.size} file entries, files array has ${files.length} files`);
                
                files.forEach(file => {
                    const fileId = file.fileId || file.file_id || file.id;
                    
                    if(!timelineFileIds.has(fileId)) {
                        console.log(`Adding missing file ${fileId} to timeline`);
                        const timelineItem = {
                            id: `file_${fileId}`,
                            messageId: `file_${fileId}`,
                            type: 'file',
                            fileId: fileId,
                            chatId: chatId,
                            senderId: file.senderId,
                            userId: file.senderId,
                            username: file.username,
                            timestamp: new Date(file.uploadedAt || file.createdAt || Date.now()).getTime(),
                            createdAt: file.uploadedAt || file.createdAt,
                            fileData: file,
                            content: file.originalFileName
                        };
                        timeline.push(timelineItem);
                    }
                });
                
                console.log(`Timeline now has ${timeline.length} total items`);
            }
            /* Timeline */
            if(Array.isArray(timeline) && timeline.length > 0) {
                const decryptedTimeline = [];
                
                const messageItems = timeline.filter(item => item.type === 'message' && !item.system);
                const fileItems = timeline.filter(item => item.type === 'file');
                const otherItems = timeline.filter(item => 
                    (item.type === 'message' && item.system) || 
                    (item.type !== 'message' && item.type !== 'file')
                );
                
                console.log(`Timeline breakdown: ${messageItems.length} messages, ${fileItems.length} files, ${otherItems.length} other`);
                
                for(const item of messageItems) {
                    try {
                        const messageService = await this.getMessageController().getMessageService();
                        const decryptedItem = await messageService.decryptMessage(chatId, item);
                        decryptedTimeline.push(decryptedItem);
                    } catch(err) {
                        console.error('Failed to decrypt timeline message:', err);
                        decryptedTimeline.push({
                            ...item,
                            content: '[Decryption failed]',
                            hasDecryptionError: true
                        });
                    }
                }

                if(fileItems.length > 0) {
                    console.log(`Decrypting ${fileItems.length} file items in timeline`);
                    const chunkSize = 3;
                    for(let i = 0; i < fileItems.length; i += chunkSize) {
                        const chunk = fileItems.slice(i, i + chunkSize);
                        
                        const chunkPromises = chunk.map(async (item) => {
                            try {
                                const fileService = await this.getFileController().getFileService();
                                const fileDataToDecrypt = item.fileData || item;
                                
                                console.log('Decrypting timeline file:', {
                                    fileId: fileDataToDecrypt.fileId,
                                    senderId: item.senderId,
                                    hasFileData: !!item.fileData
                                });
                                
                                const fileArray = Array.isArray(fileDataToDecrypt) ? fileDataToDecrypt : [fileDataToDecrypt];
                                const decryptedFiles = await fileService.decryptFile(chatId, fileArray);
                                if(!decryptedFiles || decryptedFiles.length === 0) {
                                    console.warn('decryptFile returned no results for file:', fileDataToDecrypt.fileId);
                                    return {
                                        ...item,
                                        hasDecryptionError: true,
                                        decryptionError: 'Decryption returned no results'
                                    };
                                }
                                
                                const decryptedFileItem = decryptedFiles[0];
                                let finalFileData = decryptedFileItem;
                                if(decryptedFileItem && decryptedFileItem['0']) {
                                    console.warn('Found corrupted file structure in decrypted result, extracting actual file data');
                                    finalFileData = decryptedFileItem['0'];
                                }
                                
                                return {
                                    ...item,
                                    fileData: finalFileData,
                                    hasDecryptionError: finalFileData.hasDecryptionError || false,
                                    decryptionError: finalFileData.decryptionError
                                };
                            } catch(err: any) {
                                console.error('Failed to decrypt timeline file:', err);
                                return {
                                    ...item,
                                    hasDecryptionError: true,
                                    decryptionError: err.message
                                };
                            }
                        });
                        
                        const chunkResults = await Promise.all(chunkPromises);
                        decryptedTimeline.push(...chunkResults);
                        
                        if(i + chunkSize < fileItems.length) {
                            await new Promise(resolve => setTimeout(resolve, 1000));
                        }
                    }
                }
                
                decryptedTimeline.push(...otherItems);
                timeline = decryptedTimeline.sort((a, b) => {
                    const timeA = a.timestamp || new Date(a.createdAt || 0).getTime() || 0;
                    const timeB = b.timestamp || new Date(b.createdAt || 0).getTime() || 0;
                    return timeA - timeB;
                });
                
                console.log(`Final timeline has ${timeline.length} items after decryption`);
            }

            return {
                messages,
                files,
                timeline,
                pagination
            };
        } catch(err) {
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
        const cacheService = await this.getCacheServiceClient();
        if(!cacheService.cache.has(chatId)) {
            console.log(`Skipping fetch for exited group: ${chatId}`);
            return { 
                messages: [], 
                files: [], 
                timeline: [], 
                fromCache: false 
            };
        }

        this.cacheServiceClient.selectChat(chatId);
        const cacheKey = `${chatId}_${userId}_${page}`;
        if(!this.cacheServiceClient.cache.has(chatId)) {
            console.log(`Initializing cache for ${chatId} before first fetch`);
            this.cacheServiceClient.init(chatId, 0, 0, 0);
        }

        if(!forceRefresh && this.isDataLoaded(chatId, page)) {
            console.log(`Returning cached data for ${chatId} page ${page}`);
            const cachedData = await this.getCachedData(chatId);
            
            if(cachedData) {
                const messages = Array.from(cachedData.messages.values());
                const files = Array.from(cachedData.files.values());
                const timeline = Array.from(cachedData.timeline.values());
                
                console.log(`Cache contains: ${messages.length} messages, ${files.length} files, ${timeline.length} timeline items`);
                
                const sortedMessages = messages.sort((a: any, b: any) => {
                    const timeA = a.timestamp || a.createdAt || 0;
                    const timeB = b.timestamp || b.createdAt || 0;
                    return timeA - timeB;
                });
                
                const sortedFiles = files.sort((a: any, b: any) => {
                    const timeA = a.timestamp || a.createdAt || 0;
                    const timeB = b.timestamp || b.createdAt || 0;
                    return timeA - timeB;
                });
                
                const sortedTimeline = timeline.sort((a: any, b: any) => {
                    const timeA = a.timestamp || a.createdAt || 0;
                    const timeB = b.timestamp || b.createdAt || 0;
                    return timeA - timeB;
                });
                
                return { 
                    messages: sortedMessages,
                    files: sortedFiles,
                    timeline: sortedTimeline,
                    fromCache: true 
                };
            }
        }
        
        if(this.cacheServiceClient.pendingRequests.has(cacheKey)) {
            console.log(`Waiting for pending request for ${chatId} page ${page}`);
            return this.cacheServiceClient.pendingRequests.get(cacheKey);
        }

        console.log(`Fetching fresh data for ${chatId} page ${page}`);
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
            console.log(`Initializing cache for ${chatId}`);
            this.cacheServiceClient.init(
                chatId,
                messages.length + (page * this.cacheServiceClient.config.pageSize),
                files.length + (page * this.cacheServiceClient.config.pageSize),
                timeline.length + (page * this.cacheServiceClient.config.pageSize)
            );
        }

        const data = this.cacheServiceClient.cache.get(chatId);
        if(!data) {
            console.error(`Failed to get cache data for ${chatId} after initialization`);
            return;
        }

        console.log(`Adding page ${page} data to cache for ${chatId}: ${messages.length} messages, ${files.length} files, ${timeline.length} timeline items`);

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
            const fileId = 
                f.fileId || 
                f.file_id || 
                f.id || 
                (f.fileData && 
                    (f.fileData.fileId || 
                        f.fileData.file_id || 
                        f.fileData.id
                    )
                );
            
            if(!fileId) {
                console.warn('File missing ID, skipping:', f);
                return;
            }
            
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
                const id = 
                    item.id || 
                    item.messageId || 
                    (item.type === 'file' && 
                        item.fileData && 
                        (item.fileData.fileId || item.fileData.file_id)
                    );
                
                if(!id) {
                    console.warn('Timeline item missing ID, skipping:', item);
                    return;
                }
                
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
        
        console.log(`Cache updated for ${chatId}: loaded pages: ${Array.from(data.loadedPages)}, messages: ${data.messageOrder.length}, files: ${data.fileOrder.length}, timeline: ${data.timelineOrder.length}`);
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
        } catch(error) {
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

    public async clearChatCache(chatId: string): Promise<void> {
        try {
            const cacheService = await this.getCacheServiceClient();
            cacheService.cache.delete(chatId);
            
            const keysToDelete = Array.from(cacheService.pendingRequests.keys())
                .filter(key => key.startsWith(`${chatId}_`));
            
            keysToDelete.forEach(key => {
                cacheService.pendingRequests.delete(key);
            });
            
            console.log(`Cleared cache for chat: ${chatId}`);
        } catch(error) {
            console.error(`Error clearing cache for ${chatId}:`, error);
        }
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