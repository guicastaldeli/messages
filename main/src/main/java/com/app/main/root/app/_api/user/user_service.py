from fastapi import HTTPException
from typing import List, Dict
import httpx

class UserService:
    def __init__(self, url: str):
        self.base_url = url
        
    ## Get All Users
    async def getAllUsers(self) -> List[Dict]:
        return await self._request("GET", f"{self.base_url}/api/users/all")
    
    ## Online Users
    async def getOnlineUsers(self) -> List[Dict]:
        return await self._request("GET", f"{self.base_url}/api/users/online")
    
    ## Get User By Email
    async def getUserByEmail(self, email: str) -> Dict:
        return await self._request("GET", f"{self.base_url}/api/users/email/{email}")
    
    ## Get User by Username
    async def getUserIdByUsername(self, username: str) -> Dict:
        return await self._request("GET", f"{self.base_url}/api/users/username/{username}")
    
    async def _request(self, method: str, url: str, json=None) -> Dict:
        async with httpx.AsyncClient() as client:
            res = await client.request(method, url, json=json)
            if(res.status_code != 200):
                raise HTTPException(status_code=res.status_code, detail=res.text)
            return res.json()