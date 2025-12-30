import { SocketClientConnect } from "../socket-client-connect";

export class FileServiceClient {
    private baseUrl: string | undefined;
    private socketClient: SocketClientConnect;

    constructor(url: string | undefined, socketClient: SocketClientConnect) {
        this.baseUrl = url;
        this.socketClient = socketClient;
    }

    /**
     * Get Chat Data
     */
     public async getChatData(
        userId: string,
        chatId: string,
        page: number = 0,
        pageSize: number = 20
    ): Promise<{
        files: any[];
        pagination: {
            page: number;
            pageSize: number;
            totalFiles: number;
            totalPages: number;
            hasMore: boolean;
            fromCache: boolean;
        }
    }> {
        try {
            const res = await fetch(
                `${this.baseUrl}/api/chat/${chatId}/data?userId=${userId}&page=${page}&pageSize=${pageSize}`
            );
            if(!res.ok) throw new Error('Failed to fetch chat data!');
            
            const data = await res.json();
            return data.data || {
                files: [],
                pagination: {
                    page,
                    pageSize,
                    totalFiles: 0,
                    totalPages: 0,
                    hasMore: false,
                    fromCache: false
                }
            };
        } catch(err) {
            console.error(`Failed to fetch chat data for ${chatId}:`, err);
            throw err;
        }
    }
}