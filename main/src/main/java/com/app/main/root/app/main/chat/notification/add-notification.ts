import { Data, NotificationServiceClient, Type } from "./notification-service-client"

export const AddNotification = (notificationService?: NotificationServiceClient) => ({
    /**
     * Init
     */
    get init() {
        return async(notificationService: NotificationServiceClient) => {
            notificationService = notificationService;
        }
    },

    /**
     * Add Message
     */
    get addMessage() {
        return async(data: any): Promise<void> => {
            const content: Data = {
                id: `msg_${data.messageId}_${Date.now()}`,
                userId: notificationService!.userId,
                type: Type.MESSAGE,
                title: notificationService!.getNotificationTitle(data),
                message: notificationService!.formatMessagePreview(data.content),
                chatId: data.chatId,
                senderId: data.senderId,
                senderName: data.username || data.senderName || 'Unknown',
                timestamp: new Date(data.timestamp || Date.now()),
                isRead: false,
                priority: 'NORMAL',
                metadata: {
                    messageId: data.messageId,
                    chatType: data.chatType,
                    originalContent: data.content
                }
            }

            await notificationService!.addNotification(content);
            notificationService!.showDesktopNotification(content);
        }
    },

    /**
     * Add File
     */
    get addFile() {
        return async(data: any): Promise<void> => {
            const content: Data = {
                id: `file_${data.fileId}_${Date.now()}`,
                userId: notificationService!.userId,
                type: Type.FILE,
                title: `${data.senderName || data.username} shared a file`,
                message: data.originalFileName || 'File shared',
                chatId: data.chatId,
                senderId: data.senderId,
                senderName: data.senderName || data.username || 'Unknown',
                timestamp: new Date(),
                isRead: false,
                priority: 'NORMAL',
                metadata: {
                    fileId: data.fileId,
                    fileType: data.fileType,
                    fileSize: data.fileSize
                }
            }

            await notificationService!.addNotification(content);
            notificationService!.showDesktopNotification(content);
        }
    },

    /**
     * System Messages
     */
    get addSystemMessage() {
        return async(data: any): Promise<void> => {
            const content: Data = {
                id: `sys_${data.event}_${Date.now()}`,
                userId: notificationService!.userId,
                type: Type.SYSTEM,
                title: data.title || 'System Notification',
                message: data.message,
                chatId: data.chatId || 'system',
                senderId: 'system',
                senderName: 'System',
                timestamp: new Date(),
                isRead: false,
                priority: data.priority || 'NORMAL',
                metadata: data.metadata
            }

            await notificationService!.addNotification(content);
            notificationService!.showDesktopNotification(content);
        }
    }
});