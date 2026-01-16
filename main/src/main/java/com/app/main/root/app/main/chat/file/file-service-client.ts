import { ChatService } from '../chat-service';
import { SocketClientConnect } from '../../socket-client-connect';

export interface DecryptedFile {
    hasDecryptionError?: boolean;
    decryptionError?: string;
    isDecrypted?: boolean;
    [key: string]: any;
}

export class FileServiceClient {
    private url: string | undefined;
    private chatService: ChatService;
    private socketClient: SocketClientConnect;
    private decryptionQueue: Array<{chatId: string, files: any[], resolve: Function, reject: Function}> = [];
    private isProcessingQueue = false;

    constructor(
        url: string | undefined, 
        chatService: ChatService, 
        socketClient: SocketClientConnect
    ) {
        this.url = url;
        this.chatService = chatService;
        this.socketClient = socketClient;
    }

    private async waitForConnection(timeoutMs: number = 30000): Promise<boolean> {
        const startTime = Date.now();
        let attempt = 0;
        
        while(!this.socketClient.isConnected && (Date.now() - startTime) < timeoutMs) {
            attempt++;
            const waitTime = Math.min(1000 * Math.pow(1.5, attempt - 1), 5000);
            
            console.log(`Connection wait attempt ${attempt}, waiting ${waitTime}ms...`);
            await new Promise(resolve => setTimeout(resolve, waitTime));
        }
        
        const connected = this.socketClient.isConnected;
        console.log(`Connection wait result: ${connected ? 'CONNECTED' : 'TIMEOUT'}`);
        return connected;
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
        formData.append('senderId', userId);
        formData.append('chatId', chatId);

        try {
            const res = await fetch(
                `${this.url}/api/files/upload/${userId}/${chatId}`,
                {
                    method: 'POST',
                    credentials: 'include',
                    body: formData
                }
            );
            
            if(!res.ok) throw new Error(`Upload failed with status: ${res.status}`);
            return await res.json();
        } catch(err) {
            console.error('Upload error:', err);
            throw err;
        }
    }

    /**
     * Delete File
     */
    public async deleteFile(fileId: string, userId: string): Promise<any> {
        try {
            const res = await fetch(`${this.url}/api/files/delete/${userId}/${fileId}`, {
                method: 'DELETE',
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json',
                }
            });
            if(!res.ok) throw new Error(`Delete failed with status: ${res.status}`);
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
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            if(!res.ok) throw new Error(`List files failed with status: ${res.status}`);
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
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            if(!res.ok) throw new Error(`Storage usage failed with status: ${res.status}`);
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
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            if(!res.ok) throw new Error(`File info failed with status: ${res.status}`);
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
            const res = await fetch(`${this.url}/api/files/count/${userId}/${chatId}`, {
                method: 'GET',
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            if(!res.ok) throw new Error(`Count files failed with status: ${res.status}`);
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
            const res = await fetch(`${this.url}/api/files/pages/${userId}/${chatId}`, {
                method: 'GET',
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            if(!res.ok) throw new Error(`Count pages failed with status: ${res.status}`);
            return await res.json();
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
            const res = await fetch(`${this.url}/api/files/cache/${userId}/${chatId}/${page}`, {
                method: 'GET',
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            if(!res.ok) throw new Error(`Cache key failed with status: ${res.status}`);
            return await res.json();
        } catch(err) {
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
            const params = new URLSearchParams({
                page: page.toString(),
                pageSize: pageSize.toString()
            });

            const res = await fetch(`${this.url}/api/files/recent/${userId}?${params}`, {
                method: 'GET',
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            
            if(!res.ok) {
                throw new Error(`Recent files failed with status: ${res.status}`);
            }
            
            return await res.json();
        } catch(err) {
            console.error('Error getting recent files:', err);
            
            return {
                chats: [],
                currentPage: page,
                pageSize: pageSize,
                totalChats: 0,
                totalPages: 0,
                hasMore: false
            };
        }
    }

    /**
     * Files Count by Chat Id
     */
    public async getFilesCountByChatId(chatId: string, userId: string): Promise<number> {
        try {
            const res = await fetch(`${this.url}/api/files/count-by-chat/${userId}/${chatId}`, {
                method: 'GET',
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            if(!res.ok) throw new Error(`Files count by chat failed with status: ${res.status}`);
            const data = await res.json();
            return data.count || 0;
        } catch(err) {
            console.error(err);
            throw err;
        }
    }

    /**
     * Download
     */
    public async downloadFile(userId: string, fileId: string): Promise<{ 
        data?: any, 
        success: any, 
        error?: any 
    }> {
        try {
            const res = await fetch(`${this.url}/api/files/download/${userId}/${fileId}`, {
                method: 'GET',
                credentials: 'include'
            });
            
            if(!res.ok) {
                return {
                    success: false,
                    error: `Download failed with status: ${res.status}`
                };
            }
            
            const data = await res.blob();
            return {
                data: data,
                success: true
            };
        } catch(error: any) {
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Recent Files Count
     */
    public async getRecentFilesCount(userId: string, chatId: string): Promise<number> {
        try {
            const res = await fetch(`${this.url}/api/files/recent-count/${userId}/${chatId}`, {
                method: 'GET',
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            if(!res.ok) throw new Error(`Recent files count failed with status: ${res.status}`);
            const data = await res.json();
            return data.count || 0;
        } catch(err) {
            console.error(err);
            throw err;
        }
    }

    /**
     * Get Fles by User Id
     */
    public async getFilesByUserId(userId: string): Promise<any[]> {
        try {
            const res = await fetch(`${this.url}/api/files/user/${userId}`, {
                method: 'GET',
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            if(!res.ok) throw new Error(`Files by user failed with status: ${res.status}`);
            const data = await res.json();
            return data.files || [];
        } catch(err) {
            console.error(err);
            throw err;
        }
    }

    /**
     * File Stats
     */
    public async getFileStats(): Promise<any[]> {
        try {
            const res = await fetch(`${this.url}/api/files/stats`, {
                method: 'GET',
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            if(!res.ok) throw new Error(`File stats failed with status: ${res.status}`);
            const data = await res.json();
            return data.stats || [];
        } catch(err) {
            console.error(err);
            throw err;
        }
    }

    /**
     * 
     * Decryption
     * 
     */
    public async decryptFile(
        chatId: string, 
        fileDataArray: any[],
        batchSize: number = 2,
        delayBetweenBatches: number = 500
    ): Promise<DecryptedFile[]> {
        return new Promise((resolve, reject) => {
            this.decryptionQueue.push({
                chatId,
                files: fileDataArray,
                resolve,
                reject
            });
            
            if(!this.isProcessingQueue) {
                this.processDecryptionQueue();
            }
        });
    }

    private async processDecryptionQueue(): Promise<void> {
        if(this.isProcessingQueue || this.decryptionQueue.length === 0) {
            return;
        }

        this.isProcessingQueue = true;

        while(this.decryptionQueue.length > 0) {
            const task = this.decryptionQueue[0];
            
            try {
                console.log(`Processing decryption queue: ${this.decryptionQueue.length} tasks remaining`);
                const result = await this.processDecryptionTask(task.chatId, task.files);
                
                this.decryptionQueue.shift();
                task.resolve(result);
                
                if(this.decryptionQueue.length > 0) {
                    await new Promise(resolve => setTimeout(resolve, 100));
                }
            } catch(error) {
                this.decryptionQueue.shift();
                task.reject(error);
                
                if((error as Error).message.includes('connection')) {
                    console.warn('Connection error in queue, waiting before next task...');
                    await new Promise(resolve => setTimeout(resolve, 2000));
                }
            }
        }

        this.isProcessingQueue = false;
    }

    private async processDecryptionTask(
        chatId: string, 
        fileDataArray: any[],
        batchSize: number = 2,
        delayBetweenBatches: number = 500
    ): Promise<DecryptedFile[]> {
        const alreadyDecrypted: DecryptedFile[] = [];
        const filesToDecrypt = fileDataArray.filter(file => {
            if(file.isDecrypted || file.decryptedData) {
                alreadyDecrypted.push(file);
                return false;
            }
            return true;
        });
        
        if(filesToDecrypt.length === 0) {
            console.log('All files already decrypted, skipping');
            return fileDataArray;
        }
        
        console.log(`Starting decryption of ${filesToDecrypt.length} files out of ${fileDataArray.length} total (${alreadyDecrypted.length} already decrypted)`);
        
        const allDecryptedFiles: DecryptedFile[] = [...alreadyDecrypted];
        
        if(!this.socketClient.isConnected) {
            const connected = await this.waitForConnection(15000);
            if(!connected) {
                throw new Error('Cannot start decryption reconnection attempt');
            }
        }
        
        for(let i = 0; i < filesToDecrypt.length; i += batchSize) {
            const batch = filesToDecrypt.slice(i, i + batchSize);
            const batchNumber = Math.floor(i / batchSize) + 1;
            const totalBatches = Math.ceil(filesToDecrypt.length / batchSize);
            
            let batchAttempt = 0;
            const maxBatchAttempts = 3;
            let batchSuccess = false;
            
            while(batchAttempt < maxBatchAttempts && !batchSuccess) {
                batchAttempt++;
                
                try {
                    if(!this.socketClient.isConnected) {
                        console.warn(`[Batch ${batchNumber}/${totalBatches}] Socket disconnected, aggressive reconnection...`);
                        const connected = await this.waitForConnection(10000);
                        if(!connected) {
                            if(batchAttempt === maxBatchAttempts) {
                                throw new Error(`[Batch ${batchNumber}/${totalBatches}] Socket reconnection failed after ${maxBatchAttempts} attempts`);
                            }
                            continue;
                        }
                    }
                    
                    console.log(`[Batch ${batchNumber}/${totalBatches}] Attempt ${batchAttempt}/${maxBatchAttempts} - Decrypting ${batch.length} files...`);
                    
                    const decryptedBatch = await this.decryptFileBatch(chatId, batch);
                    allDecryptedFiles.push(...decryptedBatch);
                    
                    console.log(`[Batch ${batchNumber}/${totalBatches}] Successfully decrypted ${decryptedBatch.length} files`);
                    batchSuccess = true;
                    
                } catch(batchErr) {
                    console.error(`[Batch ${batchNumber}/${totalBatches}] Attempt ${batchAttempt}/${maxBatchAttempts} failed:`, batchErr);
                    
                    if(batchAttempt === maxBatchAttempts) {
                        const failedFiles = batch.map(file => ({
                            ...file,
                            hasDecryptionError: true,
                            decryptionError: `Failed after ${maxBatchAttempts} attempts: ${(batchErr as Error).message}`,
                            isDecrypted: false
                        }));
                        
                        allDecryptedFiles.push(...failedFiles);
                        
                        console.warn(`[Batch ${batchNumber}/${totalBatches}] All attempts failed, marking batch as errored`);
                    } else {
                        const retryDelay = 1000 * batchAttempt;
                        console.warn(`[Batch ${batchNumber}/${totalBatches}] Waiting ${retryDelay}ms before retry...`);
                        await new Promise(resolve => setTimeout(resolve, retryDelay));
                    }
                }
            }
            
            if(i + batchSize < filesToDecrypt.length && batchSuccess) { 
                console.log(`[Batch ${batchNumber}/${totalBatches}] Waiting ${delayBetweenBatches}ms before next batch...`);
                await new Promise(resolve => setTimeout(resolve, delayBetweenBatches));
            }
        }
        
        return allDecryptedFiles;
    }

    private async decryptFileBatch(chatId: string, fileDataArray: any[]): Promise<DecryptedFile[]> {
        const maxRetries = 3;
        
        for(let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                if(!this.socketClient.isConnected) {
                    const connected = await this.waitForConnection(5000);
                    if(!connected) {
                        if(attempt === maxRetries) {
                            throw new Error('Socket connection unavailable after retries');
                        }
                        continue;
                    }
                }
                
                return await new Promise(async (res, rej) => {
                    const successDestination = '/queue/decrypted-files-scss';
                    const errDestination = '/queue/decrypted-files-err';

                    const handleSuccess = (response: any) => {
                        this.socketClient.offDestination(successDestination, handleSuccess);
                        this.socketClient.offDestination(errDestination, handleErr);
                        if(response.files && response.files.length > 0) {
                            res(response.files);
                        } else {
                            rej(new Error('No decrypted files returned'));
                        }
                    };

                    const handleErr = (error: any) => {
                        this.socketClient.offDestination(successDestination, handleSuccess);
                        this.socketClient.offDestination(errDestination, handleErr);
                        rej(new Error(error.message || 'Failed to decrypt files'));
                    };

                    try {
                        if(!this.socketClient.isConnected) {
                            rej(new Error('Socket connection lost during setup'));
                            return;
                        }
                        
                        await this.socketClient.onDestination(successDestination, handleSuccess);
                        await this.socketClient.onDestination(errDestination, handleErr);
                        
                        const payload = { 
                            files: fileDataArray,
                            chatId: chatId
                        };

                        const sent = await this.socketClient.sendToDestination(
                            '/app/get-decrypted-files',
                            payload,
                            successDestination
                        );
                        
                        if(!sent) {
                            rej(new Error('Failed to send decryption request'));
                        }
                    } catch(err) {
                        this.socketClient.offDestination(successDestination, handleSuccess);
                        this.socketClient.offDestination(errDestination, handleErr);
                        rej(err);
                    }
                });
            } catch(err) {
                console.error(`Decryption batch attempt ${attempt}/${maxRetries} failed:`, err);
                
                if(attempt === maxRetries) {
                    throw err;
                }
                
                await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
            }
        }
        
        throw new Error('All decryption batch attempts failed');
    }
}