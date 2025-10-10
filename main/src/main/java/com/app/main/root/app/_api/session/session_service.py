from fastapi import HTTPException
import httpx

class SessionService:
    def __init__(self, url: str):
        self.base_url = url
        
    ##
    ## Get Session
    ##
    async def getSession(self, userId: str) -> dict:
        return await self._request("get", "/api/session/{userId}")
    
    ##
    ## Session Stats
    ##
    async def getSessionStats(self) -> dict:
        return await self._request("get", "/api/session/stats")
    
    ##
    ## Active Sessions
    ##
    async def getActiveSessions(self) -> dict:
        return await self._request("post", "/api/session/active")
    
    ##
    ## Update Session Type
    ##
    async def updateSessionType(self, userId: str, sessionType: str) -> dict:
        return await self._request("put", "/api/session/{userId}/type", params={"sessionType": sessionType})
    
    ##
    ## Update Session
    ##
    async def updateSession(
        self, 
        userId: str, 
        username: str, 
        sessionType: str
    ) -> dict:
        params = {
            "userId": userId,
            "username": username,
            "sessionType": sessionType
        }
        return await self._request("get", "/api/session/update", params=params)
    
    ## -----------
    ##   Wrapper
    ## -----------
    async def _request(self, method: str, path: str):
        async with httpx.AsyncClient() as client:
            res = await client.request(method, f"{self.base_url}{path}")
            if(res.status_code != 200):
                raise HTTPException(status_code=res.status_code, detail=res.text)
            return res.json()