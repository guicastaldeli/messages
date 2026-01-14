import { SocketClientConnect } from "../../socket-client-connect";
import { ChatService } from "../chat-service";

export interface DecryptedFile {
    hasDecryptionError?: boolean;
    decryptionError?: string;
    isDecrypted?: boolean;
    [key: string]: any;
}

export class FileServiceClient {
    private url: string | undefined;
    private chatService: ChatService
    private socketClient: SocketClientConnect;

    constructor(url: string | undefined, chatService: ChatService, socketClient: SocketClientConnect) {
        this.url = url;
        this.chatService = chatService;
        this.socketClient = socketClient;
    }

    /**
     * Add File
     */
    public async addFile(chatId: string, fileData: any): Promise<void> {
        try {
            const res = await fetch(`${this.url}/api/files/add`, {
                method: 'POST',
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ chatId, fileData })
            });
            if(!res.ok) throw new Error('Failed to add file');
        } catch(err) {
            console.error('Error adding file:', err);
            throw err;
        }
    }

    /**
     * Decrypt File
     */
    public async decryptFile(chatId: string, fileDataArray: any[]): Promise<DecryptedFile[]> {
        return new Promise(async (res, rej) => {
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
                this.socketClient.onDestination(successDestination, handleSuccess);
                this.socketClient.onDestination(errDestination, handleErr);
                
                const payload = { 
                    files: fileDataArray,
                    chatId: chatId
                };

                await this.socketClient.sendToDestination(
                    '/app/get-decrypted-files',
                    payload,
                    successDestination
                );
            } catch(err) {
                this.socketClient.offDestination(successDestination, handleSuccess);
                this.socketClient.offDestination(errDestination, handleErr);
                rej(err);
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
            
            if(!res.ok) throw new Error('Upload failed');
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
                credentials: 'include',
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
                credentials: 'include',
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
                credentials: 'include',
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
                credentials: 'include',
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
                credentials: 'include',
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
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            if(!res.ok) {
                throw new Error(`Failed to get cache key: ${res.statusText}`);
            }
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
            const res = await fetch(
                `${this.url}/api/files/recent/${userId}?page=${page}&pageSize=${pageSize}`,
                {
                    credentials: 'include'
                }
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
     * Get Files Count By Chat Id
     */
    public async getFilesCountByChatId(chatId: string, userId: string): Promise<number> {
        try {
            const params = new URLSearchParams({
                userId: userId,
                chatId: chatId
            });

            const url = `${this.url}/api/files/count?${params.toString()}`;
            console.log(`Fetching files count from: ${url}`);
            
            const res = await fetch(url, {
                credentials: 'include'
            });
            if(!res.ok) throw new Error(`Failed to fetch files count: ${res.status}`);
            
            const contentType = res.headers.get('content-type');
            let count = 0;
            
            if(contentType && contentType.includes('application/json')) {
                const data = await res.json();
                console.log(`Files count response:`, data);
                if(typeof data === 'number') {
                    count = data;
                } else {
                    count = data.total || data.count || data.totalFiles || data.total_count || 0;
                }
            } else {
                const text = await res.text();
                count = parseInt(text) || 0;
            }
            
            console.log(`Parsed files count: ${count}`);
            return count;
        } catch(err) {
            console.error(`Error fetching files count for chat ${chatId}:`, err);
            throw err;
        }
    }

    /**
     * Download File
     */
    public async downloadFile(userId: string, fileId: string): Promise<{ 
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
        } catch(error: any) {
            console.error('Download error:', error);
            return {
                success: false,
                error: error.file
            };
        }
    }

    /**
     * Get Recent Files Count
     */
    public async getRecentFilesCount(userId: string): Promise<number> {
        try {
            const res = await fetch(`${this.url}/api/files/recent/${userId}/count`, {
                credentials: 'include'
            });
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
            const res = await fetch(`${this.url}/api/files/user/${userId}`, {
                credentials: 'include'
            });
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
            const res = await fetch(`${this.url}/api/files/stats`, {
                credentials: 'include'
            });
            if(!res.ok) throw new Error('Failed to fetch file stats');
            return await res.json();
        } catch(err) {
            console.error('Failed to fetch file stats:', err);
            throw err;
        }
    }

    /**
     * Search Files
     */
    public async searchFiles(query: string, userId: string): Promise<any[]> {
        try {
            const res = await fetch(
                `${this.url}/api/files/search?q=${encodeURIComponent(query)}&userId=${userId}`,
                {
                    credentials: 'include'
                }
            );
            if(!res.ok) throw new Error('Failed to search files');
            return await res.json();
        } catch(err) {
            console.error('Failed to search files:', err);
            throw err;
        }
    }

    /**
     * Get File Preview
     */
    public async getFilePreview(fileId: string, userId: string): Promise<any> {
        try {
            const res = await fetch(`${this.url}/api/files/preview/${userId}/${fileId}`, {
                credentials: 'include'
            });
            if(!res.ok) throw new Error('Failed to get file preview');
            return await res.json();
        } catch(err) {
            console.error('Failed to get file preview:', err);
            throw err;
        }
    }

    /**
     * Update File Metadata
     */
    public async updateFileMetadata(fileId: string, userId: string, metadata: any): Promise<any> {
        try {
            const res = await fetch(`${this.url}/api/files/metadata/${userId}/${fileId}`, {
                method: 'PUT',
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(metadata)
            });
            if(!res.ok) throw new Error('Failed to update file metadata');
            return await res.json();
        } catch(err) {
            console.error('Failed to update file metadata:', err);
            throw err;
        }
    }

    /**
     * Share File
     */
    public async shareFile(fileId: string, userId: string, targetUserId: string): Promise<any> {
        try {
            const res = await fetch(`${this.url}/api/files/share/${userId}/${fileId}`, {
                method: 'POST',
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ targetUserId })
            });
            if(!res.ok) throw new Error('Failed to share file');
            return await res.json();
        } catch(err) {
            console.error('Failed to share file:', err);
            throw err;
        }
    }

    /**
     * Get Shared Files
     */
    public async getSharedFiles(userId: string): Promise<any[]> {
        try {
            const res = await fetch(`${this.url}/api/files/shared/${userId}`, {
                credentials: 'include'
            });
            if(!res.ok) throw new Error('Failed to get shared files');
            return await res.json();
        } catch(err) {
            console.error('Failed to get shared files:', err);
            throw err;
        }
    }

    /**
     * Get File Permissions
     */
    public async getFilePermissions(fileId: string, userId: string): Promise<any[]> {
        try {
            const res = await fetch(`${this.url}/api/files/permissions/${userId}/${fileId}`, {
                credentials: 'include'
            });
            if(!res.ok) throw new Error('Failed to get file permissions');
            return await res.json();
        } catch(err) {
            console.error('Failed to get file permissions:', err);
            throw err;
        }
    }

    /**
     * Set File Permissions
     */
    public async setFilePermissions(fileId: string, userId: string, permissions: any): Promise<any> {
        try {
            const res = await fetch(`${this.url}/api/files/permissions/${userId}/${fileId}`, {
                method: 'POST',
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(permissions)
            });
            if(!res.ok) throw new Error('Failed to set file permissions');
            return await res.json();
        } catch(err) {
            console.error('Failed to set file permissions:', err);
            throw err;
        }
    }

    /**
     * Get File Versions
     */
    public async getFileVersions(fileId: string, userId: string): Promise<any[]> {
        try {
            const res = await fetch(`${this.url}/api/files/versions/${userId}/${fileId}`, {
                credentials: 'include'
            });
            if(!res.ok) throw new Error('Failed to get file versions');
            return await res.json();
        } catch(err) {
            console.error('Failed to get file versions:', err);
            throw err;
        }
    }

    /**
     * Restore File Version
     */
    public async restoreFileVersion(fileId: string, userId: string, versionId: string): Promise<any> {
        try {
            const res = await fetch(`${this.url}/api/files/versions/${userId}/${fileId}/restore/${versionId}`, {
                method: 'POST',
                credentials: 'include'
            });
            if(!res.ok) throw new Error('Failed to restore file version');
            return await res.json();
        } catch(err) {
            console.error('Failed to restore file version:', err);
            throw err;
        }
    }

    /**
     * Archive File
     */
    public async archiveFile(fileId: string, userId: string): Promise<any> {
        try {
            const res = await fetch(`${this.url}/api/files/archive/${userId}/${fileId}`, {
                method: 'POST',
                credentials: 'include'
            });
            if(!res.ok) throw new Error('Failed to archive file');
            return await res.json();
        } catch(err) {
            console.error('Failed to archive file:', err);
            throw err;
        }
    }

    /**
     * Restore File
     */
    public async restoreFile(fileId: string, userId: string): Promise<any> {
        try {
            const res = await fetch(`${this.url}/api/files/restore/${userId}/${fileId}`, {
                method: 'POST',
                credentials: 'include'
            });
            if(!res.ok) throw new Error('Failed to restore file');
            return await res.json();
        } catch(err) {
            console.error('Failed to restore file:', err);
            throw err;
        }
    }

    /**
     * Get Archived Files
     */
    public async getArchivedFiles(userId: string): Promise<any[]> {
        try {
            const res = await fetch(`${this.url}/api/files/archived/${userId}`, {
                credentials: 'include'
            });
            if(!res.ok) throw new Error('Failed to get archived files');
            return await res.json();
        } catch(err) {
            console.error('Failed to get archived files:', err);
            throw err;
        }
    }

    /**
     * Get File Analytics
     */
    public async getFileAnalytics(userId: string): Promise<any> {
        try {
            const res = await fetch(`${this.url}/api/files/analytics/${userId}`, {
                credentials: 'include'
            });
            if(!res.ok) throw new Error('Failed to get file analytics');
            return await res.json();
        } catch(err) {
            console.error('Failed to get file analytics:', err);
            throw err;
        }
    }

    /**
     * Export Files
     */
    public async exportFiles(userId: string, format: string = 'json'): Promise<any> {
        try {
            const res = await fetch(`${this.url}/api/files/export/${userId}?format=${format}`, {
                credentials: 'include'
            });
            if(!res.ok) throw new Error('Failed to export files');
            return await res.json();
        } catch(err) {
            console.error('Failed to export files:', err);
            throw err;
        }
    }

    /**
     * Import Files
     */
    public async importFiles(userId: string, files: any[]): Promise<any> {
        try {
            const res = await fetch(`${this.url}/api/files/import/${userId}`, {
                method: 'POST',
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ files })
            });
            if(!res.ok) throw new Error('Failed to import files');
            return await res.json();
        } catch(err) {
            console.error('Failed to import files:', err);
            throw err;
        }
    }

    /**
     * Cleanup Files
     */
    public async cleanupFiles(userId: string): Promise<any> {
        try {
            const res = await fetch(`${this.url}/api/files/cleanup/${userId}`, {
                method: 'POST',
                credentials: 'include'
            });
            if(!res.ok) throw new Error('Failed to cleanup files');
            return await res.json();
        } catch(err) {
            console.error('Failed to cleanup files:', err);
            throw err;
        }
    }

    /**
     * Get File Sync Status
     */
    public async getFileSyncStatus(userId: string): Promise<any> {
        try {
            const res = await fetch(`${this.url}/api/files/sync/${userId}`, {
                credentials: 'include'
            });
            if(!res.ok) throw new Error('Failed to get file sync status');
            return await res.json();
        } catch(err) {
            console.error('Failed to get file sync status:', err);
            throw err;
        }
    }

    /**
     * Sync Files
     */
    public async syncFiles(userId: string): Promise<any> {
        try {
            const res = await fetch(`${this.url}/api/files/sync/${userId}/start`, {
                method: 'POST',
                credentials: 'include'
            });
            if(!res.ok) throw new Error('Failed to sync files');
            return await res.json();
        } catch(err) {
            console.error('Failed to sync files:', err);
            throw err;
        }
    }

    /**
     * Get File Backup
     */
    public async getFileBackup(userId: string): Promise<any> {
        try {
            const res = await fetch(`${this.url}/api/files/backup/${userId}`, {
                credentials: 'include'
            });
            if(!res.ok) throw new Error('Failed to get file backup');
            return await res.json();
        } catch(err) {
            console.error('Failed to get file backup:', err);
            throw err;
        }
    }

    /**
     * Create File Backup
     */
    public async createFileBackup(userId: string): Promise<any> {
        try {
            const res = await fetch(`${this.url}/api/files/backup/${userId}/create`, {
                method: 'POST',
                credentials: 'include'
            });
            if(!res.ok) throw new Error('Failed to create file backup');
            return await res.json();
        } catch(err) {
            console.error('Failed to create file backup:', err);
            throw err;
        }
    }

    /**
     * Restore File Backup
     */
    public async restoreFileBackup(userId: string, backupId: string): Promise<any> {
        try {
            const res = await fetch(`${this.url}/api/files/backup/${userId}/restore/${backupId}`, {
                method: 'POST',
                credentials: 'include'
            });
            if(!res.ok) throw new Error('Failed to restore file backup');
            return await res.json();
        } catch(err) {
            console.error('Failed to restore file backup:', err);
            throw err;
        }
    }
}