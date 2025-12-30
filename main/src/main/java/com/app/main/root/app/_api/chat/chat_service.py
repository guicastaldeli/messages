from fastapi import HTTPException
import httpx

class ChatService:
    def __init__(self, url: str):
        self.base_url = url
    
    ## Chat Data
    async def getChatData(
        self, 
        userId: str,
        chatId: str,
        page: int = 0,
        pageSize: int = 20
    ) -> dict:
        return await self._request(
            "get", 
            f"/api/chat/{chatId}/data?userId={userId}&page={page}&pageSize={pageSize}"
        )
    
    ## Clear Chat Cache
    async def clearChatCache(self, userId: str, chatId: str) -> dict:
        return await self._request(
            "delete", 
            f"/api/chat/{chatId}/cache?userId={userId}"
        )
    
    ## Cache Stats
    async def getCacheStats(self) -> dict:
        return await self._request("get", "/api/chat/cache/stats")
    
    async def _request(self, method: str, path: str, json=None):
        async with httpx.AsyncClient() as client:
            res = await client.request(method, f"{self.base_url}{path}", json=json)
            if(res.status_code != 200):
                raise HTTPException(status_code=res.status_code, detail=res.text)
            return res.json()