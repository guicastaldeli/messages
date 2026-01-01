import { SocketClientConnect } from "../../socket-client-connect";
import { ChatService } from "../chat-service";

export class FileServiceClient {
    private url: string | undefined;
    private chatService: ChatService
    private socketClient: SocketClientConnect;
    
    constructor(
        url: string | undefined, 
        socketClient: SocketClientConnect,
        chatService: ChatService
    ) {
        this.url = url;
        this.socketClient = socketClient;
        this.chatService = chatService;
    }

    /**
     * Add File
     */
    public async addFile(chatId: string, fileData: any): Promise<void> {
        const cacheService = await this.chatService.getCacheServiceClient();
        const data = cacheService.cache.get(chatId);
        
        if(!data) {
            console.warn(`Cache not initialized for chat ${chatId}`);
            return;
        }
        
        const fileId = fileData.file_id || fileData.fileId || fileData.id;
        
        if(!data.files.has(fileId)) {
            data.files.set(fileId, fileData);
            data.fileOrder.push(fileId);
            data.totalFilesCount = Math.max(data.totalFilesCount, data.fileOrder.length);
            data.lastUpdated = Date.now();
        }
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
                `${this.url}/api/chat/${chatId}/data?userId=${userId}&page=${page}&pageSize=${pageSize}`
            );
            if(!res.ok) {
                const errorText = await res.text();
                console.error(`API Error (${res.status}):`, errorText);
                throw new Error(`Failed to fetch chat data! Status: ${res.status}`);
            }

            const resData = await res.json();
            if(resData.success === false) {
                throw new Error(resData.error || 'Failed to fetch chat data');
            }
            if(resData.data) {
                const data = resData.data;

                if(Array.isArray(data.files)) {
                    const decryptedFiles = [];

                    for (const file of data.files) {
                        try {
                            const decryptedFile = await this.decryptFile(chatId, file);
                            decryptedFiles.push(decryptedFile);
                        } catch (err) {
                            if(!file.system) {
                                console.error('Failed to decrypt file:', err);
                            }
                            decryptedFiles.push(file);
                        }
                    }

                    data.files = decryptedFiles.map(
                        (file: any) => ({ ...file })
                    );
                }

                return data;
            }

            if(resData.files !== undefined) {
                return resData;
            }

            console.warn('Unexpected response structure:', resData);
            return {
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
        } catch (err) {
            console.error(`Failed to fetch chat data for ${chatId}:`, err);
            throw err;
        }
    }

    public async decryptFile(chatId: string, fileData: any): Promise<any> {
        return new Promise(async (resolve, reject) => {
            const successDestination = '/queue/decrypted-files-scss';
            const errorDestination = '/queue/decrypted-files-err';

            const handleSuccess = (response: any) => {
                this.socketClient.offDestination(successDestination, handleSuccess);
                this.socketClient.offDestination(errorDestination, handleError);
                if(response.files && response.files.length > 0) {
                    resolve(response.files[0]);
                } else {
                    reject(new Error('No decrypted files returned'));
                }
            };

            const handleError = (error: any) => {
                this.socketClient.offDestination(successDestination, handleSuccess);
                this.socketClient.offDestination(errorDestination, handleError);
                reject(new Error(error.message || 'Failed to decrypt file'));
            };

            try {
                this.socketClient.onDestination(successDestination, handleSuccess);
                this.socketClient.onDestination(errorDestination, handleError);
                
                const payload = { 
                    files: [fileData],
                    chatId: String(fileData.chatId || chatId)
                };

                await this.socketClient.sendToDestination(
                    '/app/get-decrypted-files',
                    payload,
                    successDestination
                );
            } catch (err) {
                this.socketClient.offDestination(successDestination, handleSuccess);
                this.socketClient.offDestination(errorDestination, handleError);
                reject(err);
            }
        });
    }


    /**
     * Upload File
     */
    public async uploadFile(
        file: File, 
        userId: string, 
        chatId: string
    ): Promise<any> {
        const formData = new FormData();
            formData.append('file', file);
            formData.append('userId', userId);
            formData.append('chatId', chatId);

        try {
            const res = await fetch(
                `${this.url}/api/files/upload/${userId}/${chatId}`,
                {
                    method: 'POST',
                    body: formData
                }
            );
            
            if(!res.ok) throw new Error('Upload failed');
            return await res.json();
        } catch(err) {
            console.error('Upload error:', err);
            throw err;
        }
    }

    /**
     * Download File
     */
    async downloadFile(userId: string, fileId: string): Promise<{ 
        data?: any, 
        success: any, 
        error?: any 
    }> {
        try {
            const res = await fetch(
                `${this.url}/api/files/download/${userId}/${fileId}`,
                {
                    method: 'GET',
                    headers: {
                        'Accept': 'application/json, application/octet-stream, */*',
                    },
                    credentials: 'include'
                }
            );
            if(!res.ok) {
                throw new Error(`Download failed!: ${res.statusText}`);
            }

            const contentType = res.headers.get('content-type');
            if(contentType && contentType.includes('application/json')) {
                const data = await res.json();
                return {
                    success: true,
                    data: data
                };
            } else {
                const arrayBuffer = await res.arrayBuffer();
                const contentDisposition = res.headers.get('content-disposition');
                let filename = fileId;
                if(contentDisposition) {
                    const match = contentDisposition.match(/filename="?(.+?)"?$/);
                    if(match) filename = match[1];
                }
                
                return {
                    success: true,
                    data: {
                        content: new Uint8Array(arrayBuffer),
                        filename: filename,
                        mimeType: contentType || 'application/octet-stream'
                    }
                };
            }
        } catch (error: any) {
            console.error('Download error:', error);
            return {
                success: false,
                error: error.file
            };
        }
    }

    /**
     * Delete File
     */
    public async deleteFile(fileId: string, userId: string): Promise<any> {
        try {
            const res = await fetch(`${this.url}/api/files/delete/${userId}/${fileId}`, {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json',
                }
            });
            if(!res.ok) {
                const errorText = await res.text();
                console.error('Delete failed with status:', res.status, 'res:', errorText);
                throw new Error(`Failed to delete file: ${res.statusText}`);
            }
            return await res.json();
        } catch(err) {
            console.error('Error deleting file:', err);
            throw err;
        }
    }

    /**
     * List Files
     */
    public async listFiles(
        userId: string, 
        chatId: string,
        page: number = 0
    ): Promise<any> {
        try {
            const params = new URLSearchParams({ 
                userId, 
                chatId,
                page: page.toString() 
            });

            const res = await fetch(`${this.url}/api/files/list?${params}`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            if(!res.ok) {
                throw new Error(`Failed to list files: ${res.statusText}`);
            }
            return await res.json();
        } catch(err) {
            console.error(err);
            throw err;
        }
    }

    /**
     * Get Storage Usage
     */
    public async getStorageUsage(userId: string): Promise<any> {
        try {
            const res = await fetch(`${this.url}/api/files/storage/${userId}`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            if(!res.ok) {
                throw new Error(`Failed to get storage usage: ${res.statusText}`);
            }
            return await res.json();
        } catch(err) {
            console.error(err);
            throw err;
        }
    }

    /**
     * Get File Info
     */
    public async getFileInfo(fileId: string, userId: string): Promise<any> {
        try {
            const res = await fetch(`${this.url}/api/files/info/${userId}/${fileId}`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            if(!res.ok) {
                throw new Error(`Failed top get file info: ${res.statusText}`);
            }
            return await res.json();
        } catch(err) {
            console.error(err);
            throw err;
        }
    }

    /**
     * Count Files
     */
    public async countFiles(userId: string, chatId: string): Promise<any> {
        try {
            const params = new URLSearchParams({ userId, chatId });
            const res = await fetch(`${this.url}/api/files/count?${params}`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            if(!res.ok) {
                throw new Error(`Failed to count files: ${res.statusText}`);
            }
            return await res.json(); 
        } catch(err) {
            console.error(err);
            throw err;
        }
    }

    /**
     * Count Pages
     */
    public async countPages(userId: string, chatId: string): Promise<any> {
        try {
            const params = new URLSearchParams({ 
                userId, 
                chatId
            });
            const res = await fetch(`${this.url}/api/files/count-pages?${params}`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            if(!res.ok) {
                throw new Error(`Failed to count files: ${res.statusText}`);
            }
            const data = await res.json();
            return {
                success: data.success,
                current: data.current,
                total: data.total,
                hasMore: data.hasMore,
                pageSize: data.pageSize,
                totalFiles: data.totalFiles
            }; 
        } catch(err) {
            console.error(err);
            throw err;
        }
    }

    /**
     * Get Cache Key
     */
    public async getCacheKey(
        userId: string, 
        chatId: string, 
        page: number
    ): Promise<any> {
        try {
            const params = new URLSearchParams({ 
                userId, 
                chatId, 
                page: page.toString() 
            });

            const res = await fetch(`${this.url}/api/files/cache-key?${params}`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            if(!res.ok) {
                throw new Error(`Failed to get cache key: ${res.statusText}`);
            }
            return await res.json();
        } catch (err) {
            console.error(err);
            throw err;
        }
    }

    /**
     * Get Recent Files
     */
    public async getRecentFiles(
        userId: string,
        page: number = 0,
        pageSize: number = 20
    ): Promise<{
        chats: any[];
        currentPage: number;
        pageSize: number;
        totalChats: number;
        totalPages: number;
        hasMore: boolean;
    }> {
        try {
            const res = await fetch(
                `${this.url}/api/files/recent/${userId}?page=${page}&pageSize=${pageSize}`
            );
            if(!res.ok) throw new Error('Failed to fetch recent files');
            
            const data = await res.json();
            return {
                chats: data.chats || data || [],
                currentPage: page,
                pageSize: pageSize,
                totalChats: data.total || data.chats?.length || 0,
                totalPages: Math.ceil((data.total || data.chats?.length || 0) / pageSize),
                hasMore: data.hasMore !== false
            };
        } catch(err) {
            console.error('Failed to fetch recent files:', err);
            throw err;
        }
    }

    /**
     * Get Files By Chat Id
     */
    public async getFilesByChatId(
        chatId: string, 
        page: number = 0
    ): Promise<{
        files: any[];
        currentPage: number;
        pageSize: number;
        totalFiles: number;
        totalPages: number;
        hasMore: boolean;
    }> {
        const pageSize: number = 20;

        try {
            const res = await fetch(
                `${this.url}/api/files/chat/${chatId}?page=${page}&pageSize=${pageSize}`
            );
            if(!res.ok) throw new Error('Failed to fetch files by chat id');

            const resData = await res.json();
            
            let files = Array.isArray(resData) ? resData : (resData.files || []);
            
            // Decrypt files if available
            if(files.length > 0) {
                const decryptedFiles = [];
                
                for (const file of files) {
                    try {
                        const decryptedFile = await this.decryptFile(chatId, file);
                        decryptedFiles.push(decryptedFile);
                    } catch (err) {
                        if(!file.system) {
                            console.error('Failed to decrypt file:', err);
                        }
                        decryptedFiles.push(file);
                    }
                }
                
                files = decryptedFiles.map((file: any) => ({ ...file }));
            }
            
            return {
                files: files,
                currentPage: page,
                pageSize: pageSize,
                totalFiles: resData.total || files.length,
                totalPages: Math.ceil((resData.total || files.length) / pageSize),
                hasMore: resData.hasMore !== false
            };
        } catch(err) {
            console.error('Failed to fetch files by chat id:', err);
            throw err;
        }
    }

    /**
     * Get Count By Chat Id
     */
    public async getFilesCountByChatId(chatId: string): Promise<number> {
        try {
            const res = await fetch(
                `${this.url}/api/files/chat/${chatId}/count`
            );
            if(!res.ok) throw new Error('Failed to fetch files count');
            
            const data = await res.json();
            return typeof data === 'number' ? data : (data.count || data.total || 0);
        } catch(err) {
            console.error('Failed to fetch files count:', err);
            throw err;
        }
    }

    /**
     * Get Recent Files Count
     */
    public async getRecentFilesCount(userId: string): Promise<number> {
        try {
            const res = await fetch(`${this.url}/api/files/recent/${userId}/count`);
            if(!res.ok) throw new Error('Failed to fetch recent files count');

            const data = await res.json();
            return data.count || 0;
        } catch(err) {
            console.error('Failed to fetch recent files count:', err);
            throw err;
        }
    }

    /**
     * Get Files By User Id
     */
    public async getFilesByUserId(userId: string): Promise<any[]> {
        try {
            const res = await fetch(`${this.url}/api/files/user/${userId}`);
            if(!res.ok) throw new Error('Failed to fetch user files');
            return await res.json();
        } catch(err) {
            console.error('Failed to fetch user files:', err);
            throw err;
        }
    }

    /**
     * Get File Stats
     */
    public async getFileStats(): Promise<any[]> {
        try {
            const res = await fetch(`${this.url}/api/files/stats`);
            if(!res.ok) throw new Error('Failed to fetch file stats');
            return await res.json();
        } catch(err) {
            console.error('Failed to fetch file stats:', err);
            throw err;
        }
    }
}