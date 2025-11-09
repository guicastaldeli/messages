from fastapi import HTTPException
import httpx

class MessageService:
    def __init__(self, url: str):
        self.base_url = url
        
    ##
    ## Save 
    ##
    async def saveMessages(self, data: dict) -> dict:
        return await self._request("post", "/api/message-tracker/messages", json=data)
    
    ##
    ## Messages
    ##
    async def getMessages(self) -> list:
        return await self._request("get", "/api/message-tracker/get-messages")
    
    ##
    ## Recent
    ##
    async def getRecentChats(
        self, 
        userId: str,
        page: int = 0,
        pageSize: int = 20
    ) -> list:
        return await self._request(
            "get", 
            f"/api/message-tracker/messages/recent/{userId}?page={page}&pageSize={pageSize}"

        )
        
    async def getRecentChatsCount(self, userId: str) -> dict:
        return await self._request("get", f"/api/messages/recent/{userId}/count")
    
    ##
    ## Chat Id
    ##
    async def getMessagesByChatId(
        self, 
        chatId: str,
        page: int = 0,
        pageSize: int = 20
    ) -> dict:
        return await self._request(
            "get", 
            f"/api/message-tracker/messages/chatId/{chatId}?page={page}&pageSize={pageSize}"
        )
        
    async def getMessagesCountByChatId(self, chatId: str) -> dict:
        return await self._request("get", f"/api/message-tracker/messages/chatId/{chatId}/count")

    ##
    ## User
    ##
    async def getMessagesByUserId(self, userId: str) -> list:
        return await self._request("get", f"/api/message-tracker/messages/userId/{userId}")

    ##
    ## Count
    ##
    async def getMessageCount(self) -> int:
        return await self._request("get", "/api/message-tracker/count")

    ##
    ## Stats
    ##
    async def getMessageStats(self) -> list:
        return await self._request("get", "/api/message-tracker/stats")

    ##
    ## Clear
    ##
    async def clearMessages(self) -> list:
        return await self._request("delete", "/api/message-tracker/clear")
    
    ## -----------
    ##   Wrapper
    ## -----------
    async def _request(self, method: str, path: str, json=None):
        async with httpx.AsyncClient() as client:
            res = await client.request(method, f"{self.base_url}{path}", json=json)
            if(res.status_code != 200):
                raise HTTPException(status_code=res.status_code, detail=res.text)
            return res.json()