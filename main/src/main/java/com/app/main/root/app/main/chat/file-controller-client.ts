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

    public getCachedFilesPage(data: any, chatId: string, page: number): any[] {
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
     * Get File Service Client
     */
    public getFileService(): FileServiceClient {
        return this.fileService;
    }
}