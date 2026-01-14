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
            const cookies = document.cookie;
            const headers: Record<string, string> = {
                'Content-Type': 'application/json'
            };
            
            if(cookies) {
                headers['Cookie'] = cookies;
                console.log(`[NotificationService] Forwarding cookies for persist: ${cookies}`);
            }

            const res = await fetch(`${this.apiClientController.getUrl()}/api/notifications`, {
                method: 'POST',
                headers: headers,
                credentials: 'include',
                body: JSON.stringify(data)
            });
            if(!res.ok) throw new Error('Failed to persist notification');
        } catch(err) {
            console.error('Notification failed', err);
        }
    }

    /**
     * Load User Notification
     */
    public async loadUserNotification(userId: string): Promise<void> {
        try {
            const cookies = document.cookie;
            const headers: Record<string, string> = {
                'Content-Type': 'application/json'
            };
            
            if(cookies) {
                headers['Cookie'] = cookies;
                console.log(`[NotificationService] Forwarding cookies for load: ${cookies}`);
            } else {
                console.warn(`[NotificationService] No cookies found for notification request`);
            }

            const res = await fetch(`${this.apiClientController.getUrl()}/api/notifications/user/${userId}`, {
                method: 'GET',
                headers: headers,
                credentials: 'include'
            });
            
            if(!res.ok) {
                const errorText = await res.text();
                console.error(`Notification API Error (${res.status}):`, errorText);
                throw new Error(`Failed to load notifications! Status: ${res.status}`);
            }

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
            } else {
                console.error('Notification API returned unsuccessful response:', data);
            }
        } catch(err) {
            console.error('Failed to load notifications', err);
        }
    }

    public async getServerUnreadCount(userId: string): Promise<number> {
        try {
            const cookies = document.cookie;
            const headers: Record<string, string> = {
                'Content-Type': 'application/json'
            };
            
            if(cookies) {
                headers['Cookie'] = cookies;
            }

            const response = await fetch(`${this.apiClientController.getUrl()}/api/notifications/user/${userId}/unread-count`, {
                method: 'GET',
                headers: headers,
                credentials: 'include'
            });
            
            if(response.ok) {
                const data = await response.json();
                return data.success ? data.count : 0;
            } else {
                const errorText = await response.text();
                console.error(`Unread count API Error (${response.status}):`, errorText);
            }
        } catch(error) {
            console.error('Failed to get server unread count:', error);
        }
        return 0;
    }

    public async updateNotificationStatus(notificationId: string, isRead: boolean): Promise<void> {
        try {
            const cookies = document.cookie;
            const headers: Record<string, string> = {
                'Content-Type': 'application/json'
            };
            
            if(cookies) {
                headers['Cookie'] = cookies;
            }

            const response = await fetch(`${this.apiClientController.getUrl()}/api/notifications/${notificationId}/read`, {
                method: 'PUT',
                headers: headers,
                credentials: 'include'
            });
            
            if(!response.ok) {
                const errorText = await response.text();
                console.error(`Update status API Error (${response.status}):`, errorText);
                throw new Error('Failed to update notification status');
            }
        } catch(error) {
            console.error('Failed to update notification status:', error);
        }
    }

    public async deleteNotification(notificationId: string): Promise<void> {
        try {
            const cookies = document.cookie;
            const headers: Record<string, string> = {
                'Content-Type': 'application/json'
            };
            
            if(cookies) {
                headers['Cookie'] = cookies;
            }

            const response = await fetch(`${this.apiClientController.getUrl()}/api/notifications/${notificationId}`, {
                method: 'DELETE',
                headers: headers,
                credentials: 'include'
            });
            
            if(!response.ok) {
                const errorText = await response.text();
                console.error(`Delete API Error (${response.status}):`, errorText);
                throw new Error('Failed to delete notification');
            }
        } catch(error) {
            console.error('Failed to delete notification:', error);
        }
    }

    public async markAllAsRead(): Promise<void> {
        try {
            const cookies = document.cookie;
            const headers: Record<string, string> = {
                'Content-Type': 'application/json'
            };
            
            if(cookies) {
                headers['Cookie'] = cookies;
            }

            const response = await fetch(`${this.apiClientController.getUrl()}/api/notifications/user/${this.notificationController.userId}/read-all`, {
                method: 'PUT',
                headers: headers,
                credentials: 'include'
            });
            
            if(!response.ok) {
                const errorText = await response.text();
                console.error(`Mark all read API Error (${response.status}):`, errorText);
                throw new Error('Failed to mark all as read');
            }
        } catch(error) {
            console.error('Failed to mark all as read:', error);
        }
    }
}