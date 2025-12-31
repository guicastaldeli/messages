export class FileServiceClient {
    private url: string | undefined;
    
    constructor(url: string | undefined) {
        this.url = url;
    }

    /**
     * Upload File
     */
    public async uploadFile(
        file: File, 
        userId: string, 
        parentFolderId: string = "root"
    ): Promise<any> {
        try {
            const formData = new FormData();
            formData.append('file', file);

            const res = await fetch(`${this.url}/api/files/upload/${userId}/${parentFolderId}`, {
                method: 'POST',
                body: formData,
                credentials: 'include'
            });
            if(!res.ok) {
                throw new Error(`Upload failed!: ${res.statusText}`);
            }
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
                error: error.message
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
        parentFolderId: string,
        page: number = 0
    ): Promise<any> {
        try {
            const params = new URLSearchParams({ 
                userId, 
                parentFolderId,
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
    public async countFiles(userId: string, folderId: string = "root"): Promise<any> {
        try {
            const params = new URLSearchParams({ userId, folderId });
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
    public async countPages(userId: string, folderId: string = "root"): Promise<any> {
        try {
            const params = new URLSearchParams({ 
                userId, 
                folderId
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
        folderId: string = "root", 
        page: number
    ): Promise<any> {
        try {
            const params = new URLSearchParams({ 
                userId, 
                folderId, 
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
}