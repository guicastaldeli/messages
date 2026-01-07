from fastapi import HTTPException
import httpx

class NotificationService:
    def __init__(self, url: str):
        self.base_url = url
    
    ## Save Notification
    async def saveNotification(self, data: dict) -> dict:
        return await self._request("post", "/api/notifications", json=data)
    
    ## Get User Notifications
    async def getUserNotifications(self, userId: str) -> dict:
        return await self._request("get", f"/api/notifications/user/{userId}")
    
    ## Mark as Read
    async def markAsRead(self, notificationId: str) -> dict:
        return await self._request("put", f"/api/notifications/{notificationId}/read")
    
    ## Mark all as Read
    async def markAllAsRead(self, userId: str) -> dict:
        return await self._request("put", f"/api/notifications/user/{userId}/read-all")
    
    ## Delete Notification
    async def deleteNotification(self, notificationId: str) -> dict:
        return await self._request("delete", f"/api/notifications/{notificationId}")
    
    ## Get Unread Count
    async def getUnreadCount(self, userId: str) -> dict:
        return await self._request("get", f"/api/notifications/user/{userId}/unread-count")
    
    ## Get Notification by Id
    async def getNotificationById(self, notificationId: str) -> dict:
        return await self._request("get", f"/api/notifications/{notificationId}")
    
    ## Clear all Notifications
    async def clearAllNotifications(self, userId: str) -> dict:
        return await self._request("delete", f"/api/notifications/user/{userId}/clear-all")
    
    ## Get Notification Stats
    async def getNotificationStats(self, userId: str) -> dict:
        return await self._request("get", f"/api/notifications/user/{userId}/stats")
    
    async def _request(self, method: str, path: str, json=None):
        async with httpx.AsyncClient() as client:
            res = await client.request(method, f"{self.base_url}{path}", json=json)
            if res.status_code != 200:
                raise HTTPException(status_code=res.status_code, detail=res.text)
            return res.json()