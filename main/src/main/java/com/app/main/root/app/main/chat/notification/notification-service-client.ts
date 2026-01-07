import { ApiClientController } from "../../_api-client/api-client-controller";
import { NotificationControllerClient } from "./notification-controller-client";
import { Data } from "./notification-controller-client";

export class NotificationServiceClient {
    private apiClientController: ApiClientController;
    private notificationController: NotificationControllerClient;

    constructor(apiClientController: ApiClientController, notificationController: NotificationControllerClient) {
        this.apiClientController = apiClientController;
        this.notificationController = notificationController;
    }

    /**
     * Persist Notification
     */
    public async persistNotification(data: Data): Promise<void> {
        try {
            const res = await fetch(`${this.apiClientController.getUrl()}/api/notifications`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            if(!res.ok) throw new Error('Failed to get session');
        } catch(err) {
            console.error('Notification failed', err);
        }
    }

    /**
     * Load User Notification
     */
    public async loadUserNotification(userId: string): Promise<void> {
        try {
            const res = await fetch(`${this.apiClientController.getUrl()}/api/notifications/user/${userId}`);
            if(!res.ok) throw new Error('Failed to load notifications!');

            const data = await res.json();
            if(data.success) {
                this.notificationController.notifications.clear();
                this.notificationController.unreadCount = 0;
                data.notifications.forEach((d: any) => {
                    const notification: Data = {
                        ...d,
                        timestamp: new Date(d.timestamp)
                    }
                    this.notificationController.notifications.set(notification.id, notification);
                    if(!notification.isRead) this.notificationController.unreadCount++;
                });

                this.notificationController.updateBadgeCount();
                this.notificationController.notifySubscribers();
            }
        } catch(err) {
            console.error('Failed to load notifications', err);
        }
    }

    public async getServerUnreadCount(userId: string): Promise<number> {
        try {
        const response = await fetch(`/api/notifications/user/${userId}/unread-count`);
        if(response.ok) {
            const data = await response.json();
            return data.success ? data.count : 0;
        }
        } catch(error) {
        console.error('Failed to get server unread count:', error);
        }
        return 0;
    }

    public async updateNotificationStatus(notificationId: string, isRead: boolean): Promise<void> {
        try {
        const response = await fetch(`/api/notifications/${notificationId}/read`, {
            method: 'PUT'
        });
            
        if(!response.ok) {
            throw new Error('Failed to update notification status');
        }
        } catch (error) {
        console.error('Failed to update notification status:', error);
        }
    }

    public async deleteNotification(notificationId: string): Promise<void> {
        try {
        const response = await fetch(`/api/notifications/${notificationId}`, {
            method: 'DELETE'
        });
            
        if(!response.ok) {
            throw new Error('Failed to delete notification');
        }
        } catch (error) {
        console.error('Failed to delete notification:', error);
        }
    }

    public async markAllAsRead(): Promise<void> {
        try {
        const response = await fetch(`/api/notifications/user/${this.notificationController.userId}/read-all`, {
            method: 'PUT'
        });
            
        if (!response.ok) {
            throw new Error('Failed to mark all as read');
        }
        } catch (error) {
        console.error('Failed to mark all as read:', error);
        }
    }
}