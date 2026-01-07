from fastapi import APIRouter, HTTPException, Query, Path
from notification.notification_service import NotificationService

class NotificationRoutes:        
    def __init__(self, service: NotificationService):
        self.service = service
        self.router = APIRouter(prefix="/api/notifications")
        self.setupRoutes()

    def setupRoutes(self):
        ## Save Notification
        @self.router.post("")
        async def saveNotification(data: dict):
            try:
                content = await self.service.saveNotification(data)
                return content
            except HTTPException as e:
                raise e
            except Exception as err:
                raise HTTPException(
                    status_code=500, 
                    detail=f"Failed to save notification: {str(err)}"
                )
        
        ## Get User Notifications
        @self.router.get("/user/{userId}")
        async def getUserNotifications(userId: str = Path(..., description="User ID")):
            try:
                content = await self.service.getUserNotifications(userId)
                return content
            except HTTPException as e:
                raise e
            except Exception as err:
                raise HTTPException(
                    status_code=500, 
                    detail=f"Failed to load notifications for user {userId}: {str(err)}"
                )
        
        ## Get Notification by Id
        @self.router.get("/{notificationId}")
        async def getNotificationById(notificationId: str = Path(..., description="Notification ID")):
            try:
                content = await self.service.getNotificationById(notificationId)
                return content
            except HTTPException as e:
                raise e
            except Exception as err:
                raise HTTPException(
                    status_code=500, 
                    detail=f"Failed to load notification {notificationId}: {str(err)}"
                )
        
        ## Mark as Read
        @self.router.put("/{notificationId}/read")
        async def markAsRead(notificationId: str = Path(..., description="Notification ID")):
            try:
                content = await self.service.markAsRead(notificationId)
                return content
            except HTTPException as e:
                raise e
            except Exception as err:
                raise HTTPException(
                    status_code=500, 
                    detail=f"Failed to mark notification {notificationId} as read: {str(err)}"
                )
        
        ## Mark all as Read
        @self.router.put("/user/{userId}/read-all")
        async def markAllAsRead(userId: str = Path(..., description="User ID")):
            try:
                content = await self.service.markAllAsRead(userId)
                return content
            except HTTPException as e:
                raise e
            except Exception as err:
                raise HTTPException(
                    status_code=500, 
                    detail=f"Failed to mark all notifications as read for user {userId}: {str(err)}"
                )
        
        ## Delete Notification
        @self.router.delete("/{notificationId}")
        async def deleteNotification(notificationId: str = Path(..., description="Notification ID")):
            try:
                content = await self.service.deleteNotification(notificationId)
                return content
            except HTTPException as e:
                raise e
            except Exception as err:
                raise HTTPException(
                    status_code=500, 
                    detail=f"Failed to delete notification {notificationId}: {str(err)}"
                )
        
        ## Clear all Notifications
        @self.router.delete("/user/{userId}/clear-all")
        async def clearAllNotifications(userId: str = Path(..., description="User ID")):
            try:
                content = await self.service.clearAllNotifications(userId)
                return content
            except HTTPException as e:
                raise e
            except Exception as err:
                raise HTTPException(
                    status_code=500, 
                    detail=f"Failed to clear all notifications for user {userId}: {str(err)}"
                )
        
        ## Get Unread Count
        @self.router.get("/user/{userId}/unread-count")
        async def getUnreadCount(userId: str = Path(..., description="User ID")):
            try:
                content = await self.service.getUnreadCount(userId)
                return content
            except HTTPException as e:
                raise e
            except Exception as err:
                raise HTTPException(
                    status_code=500, 
                    detail=f"Failed to get unread count for user {userId}: {str(err)}"
                )