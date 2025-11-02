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
    ## User
    ##
    async def getMessagesByUsername(self, username: str) -> list:
        return await self._request("get", f"/api/message-tracker/messages/user/{username}")

    ##
    ## Chat Id
    ##
    async def getMessagesByChatId(self, chatId: str) -> list:
        return await self._request("get", f"/api/message-tracker/messages/chatId/{chatId}")

    ##
    ## Recent
    ##
    async def getRecentMessages(self, userId: str, count: int) -> list:
        return await self._request("get", f"/api/message-tracker/messages/recent/{userId}/{count}")

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