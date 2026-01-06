import { CacheServiceClient } from "@/app/_cache/cache-service-client"

export class AddToCache {
    private cacheService: CacheServiceClient;

    constructor(cacheService: CacheServiceClient) {
        this.cacheService = cacheService;
    }

    /**
     * Add Message
     */
    public async addMessage(chatId: string, data: any): Promise<void> {
        try {
            const cacheData = this.cacheService.getCacheData(chatId);
            if(!cacheData) {
                console.log(`Cache not found for ${chatId}, initializing`);
                this.cacheService.init(chatId);
                return;
            } 

            const messageId = data.messageId || data.id;
            if(!messageId) {
                console.error('Message data missing ID:', data);
                return;
            }

            if(!cacheData.messages.has(messageId)) {
                cacheData.messages.set(messageId, data);
                cacheData.messageOrder.push(messageId);
                cacheData.totalMessagesCount++;
            }
            if(!cacheData.timeline.has(messageId)) {
                const timelineItem = {
                    ...data,
                    type: data.isSystem ? 'system' : 'message',
                    isSystem: data.isSystem || false
                };
                cacheData.timeline.set(messageId, timelineItem);
                cacheData.timelineOrder.push(messageId);
                cacheData.totalTimelineCount++;
            }

            cacheData.lastAccessTime = Date.now();
            cacheData.lastUpdated = Date.now();
            
            console.log(`Updated cache for ${chatId} with message ${messageId}`);
        } catch(err) {
            console.error(`Failed to update cache for ${chatId}:`, err);
        }
    }

    /**
     * Add File
     */
    public async addFile(chatId: string, data: any): Promise<void> {
        try {
            const cacheData = this.cacheService.getCacheData(chatId);
            
            if(!cacheData) {
                console.log(`Cache not found for ${chatId}, initializing`);
                this.cacheService.init(chatId);
                return;
            }
            
            const fileId = data.fileId || data.id;
            if(!fileId) {
                console.error('File data missing ID:', data);
                return;
            }
            
            if(!cacheData.files.has(fileId)) {
                cacheData.files.set(fileId, data);
                cacheData.fileOrder.push(fileId);
                cacheData.totalFilesCount++;
            }
            if(!cacheData.timeline.has(fileId)) {
                const timelineItem = {
                    ...data,
                    type: 'file',
                    isSystem: false
                };
                cacheData.timeline.set(fileId, timelineItem);
                cacheData.timelineOrder.push(fileId);
                cacheData.totalTimelineCount++;
            }
    
            cacheData.lastAccessTime = Date.now();
            cacheData.lastUpdated = Date.now();
            
            console.log(`Updated cache for ${chatId} with file ${fileId}`);
            
        } catch(err) {
            console.error(`Failed to update cache for ${chatId}:`, err);
        }
    }

    /**
     * Add System Message
     */
    public async addSystemMessage(chatId: string, data: any): Promise<void> {
        try {
            const cacheData = this.cacheService.getCacheData(chatId);
            
            if(!cacheData) {
                console.log(`Cache not found for ${chatId}, initializing`);
                this.cacheService.init(chatId);
                return;
            }
            
            const messageId = data.messageId || data.id;
            if(!messageId) {
                console.error('System message data missing ID:', data);
                return;
            }
            
            if(!cacheData.timeline.has(messageId)) {
                const timelineItem = {
                    ...data,
                    type: 'system',
                    isSystem: true
                };
                cacheData.timeline.set(messageId, timelineItem);
                cacheData.timelineOrder.push(messageId);
                cacheData.totalTimelineCount++;
            }
            
            cacheData.lastAccessTime = Date.now();
            cacheData.lastUpdated = Date.now();
            
            console.log(`Updated cache for ${chatId} with system message ${messageId}`);
            
        } catch(err) {
            console.error(`Failed to update cache for ${chatId}:`, err);
        }
    }
}