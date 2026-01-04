import { ChatService } from "../chat-service"; 
import { ApiClientController } from "../../_api-client/api-client-controller";
import { SocketClientConnect } from "../../socket-client-connect";
import { FileServiceClient } from "./file-service-client";

export class FileControllerClient {
    private chatService: ChatService;
    private socketClientConnect: SocketClientConnect;
    private apiClientController: ApiClientController;
    private fileService: FileServiceClient;
    
    constructor(
        socketClientConnect: SocketClientConnect,
        apiClientController: ApiClientController,
        chatService: ChatService
    ) {
        this.socketClientConnect = socketClientConnect;
        this.apiClientController = apiClientController;
        this.chatService = chatService;
        this.fileService = new FileServiceClient(
            this.apiClientController.getUrl(), 
            this.socketClientConnect,
            chatService
        );
    }

    public async getFilesPage(data: any, chatId: string, page: number): Promise<any[]> {
        const cacheService = await this.chatService.getCacheServiceClient();
        const startIdx = page * cacheService.config.pageSize;
        const endIdx = Math.min(
            startIdx + cacheService.config.pageSize, 
            data.fileOrder.length
        );
        const files: any[] = [];

        for(let i = startIdx; i < endIdx; i++) {
            const fileId = data.fileOrder[i];
            const file = data.files.get(fileId);
            if(file) files.push(file);
        }
        return files;
    }

    public async hasMoreFiles(chatId: string): Promise<boolean> {
        const cacheService = await this.chatService.getCacheServiceClient();
        const data = cacheService.cache.get(chatId);
        if(!data) return false;
        return data.hasMoreFiles;
    }

    public async getTotalFiles(chatId: string): Promise<number> {
        const cacheService = await this.chatService.getCacheServiceClient();
        const data = cacheService.cache.get(chatId);
        return data ? data.totalFilesCount : 0;
    }

    /**
     * Init Cache
     */
    public async initCache(userId: string, activeChatId?: string): Promise<void> {
        try {
            console.log('Starting file cache initialization for user:', userId);
            
            const recentFilesResponse = await this.fileService.getRecentFiles(userId);
            console.log('Recent files response:', recentFilesResponse);
            
            let chats = [];
            if(Array.isArray(recentFilesResponse)) {
                chats = recentFilesResponse;
            } else if(recentFilesResponse && Array.isArray(recentFilesResponse.chats)) {
                chats = recentFilesResponse.chats;
            } else {
                console.warn('getRecentFiles did not return expected format:', recentFilesResponse);
                chats = [];
            }
            
            let actualActiveChatId = activeChatId;
            if(activeChatId && activeChatId.startsWith('{')) {
                try {
                    const chatObj = JSON.parse(activeChatId);
                    actualActiveChatId = chatObj.id || chatObj.chatId || activeChatId;
                    console.log(`Extracted active chat ID from object: ${actualActiveChatId}`);
                } catch(err) {
                    console.warn('Failed to parse activeChatId as JSON, using as-is:', activeChatId);
                }
            }
            
            if(actualActiveChatId && actualActiveChatId !== 'null' && actualActiveChatId !== 'undefined') {
                const activeChatExists = chats.some(chat => {
                    const chatId = chat.id || chat.chatId;
                    return chatId === actualActiveChatId;
                });
                if(!activeChatExists) {
                    console.log(`Adding active chat to preload: ${actualActiveChatId}`);
                    chats.push({ id: actualActiveChatId, chatId: actualActiveChatId });
                }
            }
            
            console.log(`Found ${chats.length} chats to preload`);
            
            const preloadPromises = chats.map(async (chat: any) => {
                const chatId = chat.id || chat.chatId;
                if(!chatId) {
                    console.warn('Chat missing ID:', chat);
                    return;
                }
                console.log(`Preloading files for chat: ${chatId}`);
                return this.preloadData(userId, chatId);
            });
            
            await Promise.all(preloadPromises);
            console.log('File cache initialization completed');
        } catch(err) {
            console.error('File cache initialization failed: ', err);
            throw err;
        }
    }

    /**
     * Preload Data
     */
    public async preloadData(userId: string, chatId: string): Promise<void> {
        console.log("PRELOAD DATA FILES")
        try {
            let actualChatId = chatId;
            if(chatId && chatId.startsWith('{')) {
                try {
                    const chatObj = JSON.parse(chatId);
                    actualChatId = chatObj.id || chatObj.chatId || chatId;
                    console.log(`Extracted chat ID from object: ${actualChatId}`);
                } catch(err) {
                    console.warn('Failed to parse chatId as JSON, using as-is:', chatId);
                }
            }

            const [countData, pageData] = await Promise.all([
                this.fileService.getFilesCountByChatId(actualChatId, userId),
                this.chatService.getChatData(userId, actualChatId, 0)
            ]);

            const cacheService = await this.chatService.getCacheServiceClient();
            if(!cacheService.cache.has(actualChatId)) {
                cacheService.init(actualChatId, 0, countData);
            }

            const cacheData = cacheService.cache.get(actualChatId)!;
            cacheData.files.clear();
            cacheData.fileOrder = [];
            
            pageData.files.forEach((file: any) => {
                const id = file.id || file.fileId;
                const fileChatId = file.chatId;
                
                if(!id) {
                    console.warn(`[preloadData] File missing ID, skipping`);
                    return;
                }
                if(fileChatId && fileChatId !== actualChatId) {
                    console.warn(`[preloadData] Skipping file ${id} - belongs to ${fileChatId}, not ${actualChatId}`);
                    return;
                }
                if(!file.chatId) {
                    file.chatId = actualChatId;
                }
                
                cacheData.files.set(id, file);
                cacheData.fileOrder.push(id);
            });
            
            cacheData.loadedFilePages.add(0);
            cacheData.totalFilesCount = countData;
            cacheData.lastAccessTime = Date.now();
            cacheData.hasMoreFiles = pageData.pagination.hasMore;
            cacheData.isFullyLoaded = !cacheData.hasMoreFiles;
            cacheData.lastUpdated = Date.now();
            
            console.log(`Preloaded ${cacheData.fileOrder.length} files for chat ${actualChatId}`);
        } catch(err) {
            console.error(`Preload for ${chatId} failed`, err);
        }
    }

    /**
     * Get File Service Client
     */
    public async getFileService(): Promise<FileServiceClient> {
        return this.fileService;
    }
}