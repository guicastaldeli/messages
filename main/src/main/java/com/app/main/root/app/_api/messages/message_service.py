from fastapi import HTTPException
import httpx

class MessageService:
    def __init__(self, url: str):
        self.base_url = url
    
    ##
    ## Messages
    ##
    async def getMessages(self) -> list:
        return await self._request("get", "/api/message-tracker/messages")

    ##
    ## User
    ##
    async def getMessagesByUser(self, username: str) -> list:
        return await self._request("get", f"/api/message-tracker/messages/user/{username}")

    ##
    ## Chat Id
    ##
    async def getMessagesByChatId(self, chat_id: str) -> list:
        return await self._request("get", f"/api/message-tracker/messages/chat/{chat_id}")

    ##
    ## Type
    ##
    async def getMessagesByType(self, type_: str) -> list:
        return await self._request("get", f"/api/message-tracker/messages/type/{type_}")

    ##
    ## Direction
    ##
    async def getMessagesByDirection(self, direction: str) -> list:
        return await self._request("get", f"/api/message-tracker/messages/direction/{direction}")

    ##
    ## Recent
    ##
    async def getRecentMessages(self, count: int) -> list:
        return await self._request("get", f"/api/message-tracker/messages/recent/{count}")

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
        return await self._request("get", "/api/message-tracker/clear")
    
    ## -----------
    ##   Wrapper
    ## -----------
    async def _request(self, method: str, path: str):
        async with httpx.AsyncClient() as client:
            res = await client.request(method, f"{self.base_url}{path}")
            if(res.status_code != 200):
                raise HTTPException(status_code=res.status_code, detail=res.text)
            return res.json()