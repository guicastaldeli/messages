from connection.connection_service import ConnectionService
from connection.connection_registry import ConnectionRegistry
from fastapi import APIRouter, HTTPException, Request
from typing import Dict

class ConnectionRoutes:
    def __init__(self, connectionService: ConnectionService):
        self.connectionService = connectionService
        self.router = APIRouter(prefix="/api/connection-tracker/connections")
        self.setupRoutes()
        self.connectionRegistry = ConnectionRegistry(self.router, self.connectionService)
        
    def setupRoutes(self):
        ##
        ## Get All Connections
        ##
        @self.router.get("/all")
        async def getAllConnections() -> dict:
            return await self.connectionService.getAllConnections()
        
        ##
        ## Get Active Connections
        ##
        @self.router.get("/active")
        async def getActiveConnections() -> list:
            return await self.connectionService.getActiveConnections()
        
        ##
        ## Count
        ##
        @self.router.get("/count")
        async def getConnectionsCount() -> Dict[str, int]:
            return {
                "total": await self.connectionService.getConnectionsCount(),
                "active": await self.connectionService.getActiveConnections()
            }
            
        ##
        ## Get Connection Socket Id
        ##
        @self.router.get("/{socketId}")
        async def getConnectionSocketId(id: str) -> dict:
            conn = await self.connectionService.getConnectionSocketId(id)
            if(not conn):
                raise HTTPException(status_code=400, detail="Connection not found!")
            return conn
        
        ##
        ## Get Connections Ip
        ##
        @self.router.get("/ip/{ipAddress}")
        async def getConnectionsIp(ip: str) -> dict:
            return await self.connectionService.getConnectionsIp(ip)
        
        ##
        ## Update Username
        ##
        @self.router.get("/{socketId}/username")
        async def updateUsername(id: str, username: str) -> dict:
            conn = await self.connectionService.updateUsername(id, username)
            if(not conn):
                raise HTTPException(status_code=400, detail="Connection not found!")
            return conn
        
        ##
        ## Track Connection
        ##
        @self.router.post("/track")
        async def trackConnection(req: Request) -> dict:
            clientHost = req.client.host if req.client else "unknown"
            userAgent = req.headers.get("user-agent", "")
            socketId = f"http_{clientHost}_{id(req)}"
            
            return await self.connectionService.trackConnection(
                socketId=socketId,
                ipAddress=clientHost,
                userAgent=userAgent
            )
            
        
                