import { ChatService } from "./chat-service"; 
import { ApiClient } from "../_api-client/api-client";
import { SocketClientConnect } from "../socket-client-connect";
import { FileServiceClient } from "../_api-client/file-service-client";

export class FileControllerClient {
    private chatService: ChatService;
    private socketClientConnect: SocketClientConnect;
    private apiClient: ApiClient;
    private fileService: FileServiceClient;
    
    constructor(
        socketClientConnect: SocketClientConnect,
        apiClient: ApiClient,
        chatService: ChatService
    ) {
        this.socketClientConnect = socketClientConnect;
        this.apiClient = apiClient;
        this.chatService = chatService;
        this.fileService = new FileServiceClient(this.apiClient.getUrl(), socketClientConnect);
    }

    public getFilesPage(data: any, chatId: string, page: number): any[] {
        const startIdx = page * this.chatService.getCacheServiceClient().config.pageSize;
        const endIdx = Math.min(
            startIdx + this.chatService.getCacheServiceClient().config.pageSize, 
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

    public hasMoreFiles(chatId: string): boolean {
        const data = this.chatService.getCacheServiceClient().cache.get(chatId);
        if(!data) return false;
        return data.hasMoreFiles;
    }

    public getTotalFiles(chatId: string): number {
        const data = this.chatService.getCacheServiceClient().cache.get(chatId);
        return data ? data.totalFilesCount : 0;
    }

    /**
     * Init Cache
     */
    public async initCache(userId: string): Promise<void> {
        try {
            const recentChats = await this.fileService.getRecentFiles(userId, 0, 50);
            const chats = recentChats.chats || [];
            const preloadPromises = chats.map((chat: any) =>
                this.chatService
                    .getCacheServiceClient()
                    .preloadChatData(chat.id || chat.chatId)
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

            this.chatService.getCacheServiceClient().init(chatId, countData);
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