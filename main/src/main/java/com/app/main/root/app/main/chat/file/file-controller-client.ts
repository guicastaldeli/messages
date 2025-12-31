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
        this.fileService = new FileServiceClient(this.apiClientController.getUrl());
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
    public async initCache(userId: string): Promise<void> {
        try {
            const recentChats = await this.fileService.getRecentFiles(userId, 0, 50);
            const chats = recentChats.chats || [];
            const preloadPromises = chats.map(async (chat: any) =>
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
                this.fileService.getFilesCountByChatId(chatId),
                this.fileService.getFilesByChatId(chatId, 0)
            ]);

            const cacheService = await this.chatService.getCacheServiceClient();
            cacheService.init(chatId, countData);
            this.getFilesPage(pageData.messages, chatId, 0);
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