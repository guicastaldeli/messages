from fastapi import HTTPException
import httpx
from typing import Dict, Optional

class SessionService:
    def __init__(self, url: str):
        self.base_url = url
        
    ## Types
    async def getSessionTypes(
        self,
        cookies: Optional[Dict[str, str]] = None
    ) -> dict:
        return await self._request(
            "get", 
            "/api/session/types",
            cookies=cookies
        )
        
    ## Get Session
    async def getSession(
        self, 
        userId: str,
        cookies: Optional[Dict[str, str]] = None
    ) -> dict:
        return await self._request(
            "get", 
            f"/api/session/{userId}",
            cookies=cookies
        )
    
    ## Session Stats
    async def getSessionStats(
        self,
        cookies: Optional[Dict[str, str]] = None
    ) -> dict:
        return await self._request(
            "get", 
            "/api/session/stats",
            cookies=cookies
        )
    
    ## Update Session Type
    async def updateSessionType(
        self, 
        userId: str, 
        sessionType: str,
        cookies: Optional[Dict[str, str]] = None
    ) -> dict:
        return await self._request(
            "put", 
            f"/api/session/{userId}/type", 
            params={"sessionType": sessionType},
            cookies=cookies
        )
    
    ## Update Session
    async def updateSession(
        self, 
        userId: str, 
        username: str, 
        sessionType: str,
        cookies: Optional[Dict[str, str]] = None
    ) -> dict:
        params = {
            "userId": userId,
            "username": username,
            "sessionType": sessionType
        }
        return await self._request(
            "post", 
            "/api/session/update", 
            params=params,
            cookies=cookies
        )
    
    async def _request(
        self, 
        method: str, 
        path: str,
        cookies: Optional[Dict[str, str]] = None,
        **kwargs
    ):
        async with httpx.AsyncClient() as client:
            url = f"{self.base_url}{path}"
            
            if cookies:
                print(f"[SessionService] Sending cookies to {url}: {list(cookies.keys())}")
            else:
                print(f"[SessionService] No cookies to send to {url}")
            
            res = await client.request(
                method, 
                url, 
                cookies=cookies,
                follow_redirects=True,
                **kwargs
            )
            
            if res.status_code != 200:
                print(f"[SessionService] Request failed with status {res.status_code}: {res.text}")
                raise HTTPException(status_code=res.status_code, detail=res.text)
            
            return res.json()