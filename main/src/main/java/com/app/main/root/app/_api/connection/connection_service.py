from fastapi import HTTPException
from typing import Dict, List
import httpx
        
class ConnectionService:    
    def __init__(self, url: str):
        self.base_url = url
    
    ##
    ## All Connections
    ##
    async def getAllConnections(self) -> dict:
        return await self._request("get", "/api/connection-tracker/connections/all")
    
    ##
    ## Active Connections
    ##
    async def getActiveConnections(self) -> list:
        return await self._request("get", "/api/connection-tracker/connections/active")
    
    
    ##
    ## By Socket Id
    ##
    async def getConnectionBySocketId(self, socketId: str) -> dict:
        return await self._request("get", f"/api/connection-tracker/connections/{socketId}")
    
    ##
    ## By Ip
    ##
    async def getConnectionsByIp(self, ipAddress: str) -> dict:
        return await self._request("get", f"/api/connection-tracker/connections/ip/{ipAddress}")
    
    ##
    ## By Username
    ##
    async def getConnectionsByUsername(self, username: str) -> list:
        return await self._request("get", f"/api/connection-tracker/connections/user/{username}")
    
    ##
    ## Update Username
    ##
    async def updateUsername(self, socketId: str, username: str) -> dict:
        return await self._request("put", f"/api/connection-tracker/connections/{socketId}/username/{username}")
    
    ##
    ## Count
    ##
    async def getConnectionsCount(self) -> int:
        return await self._request("get", "/api/connection-tracker/count")
    
    ##
    ## Track Connection
    ##
    async def trackConnection(
        self,
        socketId: str,
        ipAddress: str,
        userAgent: str = ""
    ) -> dict:
        params = {
            "socketId": socketId,
            "ipAddress": ipAddress,
            "userAgent": userAgent
        }
        return await self._request("post", "/api/connection-tracker/connections/track", params=params)
    
    ##
    ## Devices
    ##
    async def getDevices(self) -> List[Dict]:
        return await self._request("get", "/api/connection-tracker/connections/registry/devices")
    
    ##
    ## Browsers
    ##
    async def getBrowsers(self) -> List[Dict]:
        return await self._request("get", "/api/connection-tracker/connections/registry/browsers")
    
    ##
    ## OS
    ##
    async def getOS(self) -> List[Dict]:
        return await self._request("get", "/api/connection-tracker/connections/registry/os")
    
    ##
    ## Train
    ##
    async def addTraining(
        self,
        userAgent: str,
        browser: str,
        os: str,
        device: str
    ) -> Dict:
        data = {
            "userAgent": userAgent,
            "browser": browser,
            "os": os,
            "device": device
        }
        return await self._request("post", "/api/connection-tracker/connections/registry/train", json=data)
    
    ##
    ## Clear Connections
    ##
    async def clearConnections(self) -> str:
        return await self._request("delete", "/api/connection-tracker/connections/clear")
                
    ## -----------
    ##   Wrapper
    ## -----------
    async def _request(self, method: str, path: str, **kwargs):
        async with httpx.AsyncClient() as client:
            url = f"{self.base_url}{path}"
            res = await client.request(method, url, **kwargs)
            if(res.status_code != 200):
                raise HTTPException(status_code=res.status_code, detail=res.text)
            return res.json()