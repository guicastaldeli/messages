from fastapi import HTTPException, Request
import httpx
from typing import Dict, Optional

class ChatService:
    def __init__(self, url: str):
        self.base_url = url
    
    ## Chat Data
    async def getChatData(
        self, 
        userId: str,
        chatId: str,
        page: int = 0,
        pageSize: int = 20,
        cookies: Optional[Dict[str, str]] = None
    ) -> dict:
        return await self._request(
            "get", 
            f"/api/chat/{chatId}/data?userId={userId}&page={page}&pageSize={pageSize}",
            cookies=cookies
        )
    
    ## Clear Chat Cache
    async def clearChatCache(
        self, 
        userId: str, 
        chatId: str,
        cookies: Optional[Dict[str, str]] = None
    ) -> dict:
        return await self._request(
            "delete", 
            f"/api/chat/{chatId}/cache?userId={userId}",
            cookies=cookies
        )
    
    ## Cache Stats
    async def getCacheStats(
        self,
        cookies: Optional[Dict[str, str]] = None
    ) -> dict:
        return await self._request(
            "get", 
            "/api/chat/cache/stats",
            cookies=cookies
        )
    
    async def _request(
        self, 
        method: str, 
        path: str, 
        json=None,
        cookies: Optional[Dict[str, str]] = None
    ):
        async with httpx.AsyncClient() as client:
            url = f"{self.base_url}{path}"
            
            # Prepare headers to forward cookies
            headers = {}
            if cookies:
                # Convert cookies dict to Cookie header string
                cookie_header = "; ".join([f"{k}={v}" for k, v in cookies.items()])
                headers["Cookie"] = cookie_header
                print(f"[ChatService] Forwarding Cookie header to {url}: {cookie_header[:100]}...")
            else:
                print(f"[ChatService] WARNING: No cookies to send to {url}")
            
            res = await client.request(
                method, 
                url, 
                json=json,
                headers=headers,  # ← Send cookies as header, not as cookies param
                follow_redirects=True
            )
            
            if res.status_code != 200:
                print(f"[ChatService] Request failed with status {res.status_code}: {res.text}")
                raise HTTPException(status_code=res.status_code, detail=res.text)
            
            return res.json()