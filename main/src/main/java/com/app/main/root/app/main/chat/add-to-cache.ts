import { CacheServiceClient } from "@/app/_cache/cache-service-client"

export const AddToCache = (cacheService?: CacheServiceClient) => ({
    /**
     * Init
     */
    get init() {
        return async(cacheService: CacheServiceClient) => {
            cacheService = cacheService;
        }
    },
    
    /**
     * Add Message
     */
    get addMessage() {
        return async(chatId: string, data: any): Promise<void> => {
            try {
                const cacheData = cacheService!.getCacheData(chatId);
                if(!cacheData) {
                    console.log(`Cache not found for ${chatId}, initializing`);
                    cacheService!.init(chatId);
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
    },

    /**
     * Add File
     */
    get addFile() {
        return async(chatId: string, data: any) => {
            if(!cacheService!.isChatCached(chatId)) {
                console.log(`Skipping cache update for exited group: ${chatId}`);
                return;
            }
    
            const cacheData = cacheService!.getCacheData(chatId);
            if(!cacheData) {
                console.error(`No cache data found for chat ${chatId}`);
                return;
            }
    
            const fileId = 
                data.fileId || 
                data.id || 
                data.fileData?.fileId || 
                data.fileData?.id ||
                data.messageId;
            if(!fileId) {
                console.error('File data missing ID:', data);
                return;
            }
    
            const fileData = {
                ...(data.fileData || data),
                fileId: fileId,
                id: fileId
            };
    
            const fileEntry = {
                id: fileId,
                fileId: fileId,
                messageId: data.messageId || fileId,
                userId: data.userId || data.senderId,
                senderId: data.senderId || data.userId,
                username: data.username,
                chatId: chatId,
                timestamp: data.timestamp || Date.now(),
                type: 'file',
                fileData: fileData,
                direction: data.direction
            };
            cacheData.files.set(fileId, fileEntry);
            
            if(!cacheData.timelineOrder.includes(fileId)) {
                cacheData.timelineOrder.push(fileId);
            }
            cacheData.timeline.set(fileId, fileEntry);
            
            console.log(`Updated cache for ${chatId} with file ${fileId}`);
        }
    },

    /**
     * Add System Message
     */
    get addSystemMessage() {
        return async(chatId: string, data: any): Promise<void> => {
            try {
                const cacheData = cacheService!.getCacheData(chatId);
                
                if(!cacheData) {
                    console.log(`Cache not found for ${chatId}, initializing`);
                    cacheService!.init(chatId);
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
})