from connection.connection_service import ConnectionService, ConnectionInfo
from fastapi import APIRouter, HTTPException, Request
from typing import List, Dict, Any

class ConnectionRoutes:
    def __init__(self):
        self.router = APIRouter(prefix="/connection-tracker/connections", tags=["connections"])
        self.connectionService = ConnectionService.getInstance()
        self.setupRoutes()
        
    def setupRoutes(self):
        ##
        ## Get All Connections
        ##
        @self.router.get("/")
        async def getAllConnections() -> Dict[str, ConnectionInfo]:
            return self.connectionService.getAllConnections()
        
        ##
        ## Get Active Connections
        ##
        @self.router.get("/active")
        async def getActiveConnections() -> List[ConnectionInfo]:
            return self.connectionService.getActiveConnections()
        
        ##
        ## Count
        ##
        @self.router.get("/count")
        async def getConnectionsCount() -> Dict[str, int]:
            return {
                "total": self.connectionService.getConnectionsCount(),
                "active": self.connectionService.getActiveConnectionsCount()
            }
            
        ##
        ## Get Connection Socket Id
        ##
        @self.router.get("/{socketId}")
        async def getConnectionSocketId(id: str) -> ConnectionInfo:
            conn = self.connectionService.getConnectionSocketId(id)
            if(not conn):
                raise HTTPException(status_code=400, detail="Connection not found!")
            return conn
        
        ##
        ## Get Connections Ip
        ##
        @self.router.get("/ip/{ipAddress}")
        async def getConnectionsIp(ip: str) -> List[ConnectionInfo]:
            return self.connectionService.getConnectionsIp(ip)
        
        ##
        ## Update Username
        ##
        @self.router.get("/{socketId}/username")
        async def updateUsername(id: str, username: str) -> ConnectionInfo:
            conn = await self.connectionService.updateUsername(id, username)
            if(not conn):
                raise HTTPException(status_code=400, detail="Connection not found!")
            return conn
        
        ##
        ## Track Connection
        ##
        @self.router.post("/track")
        async def trackConnection(req: Request) -> ConnectionInfo:
            clientHost = req.client.host if req.client else "unknown"
            userAgent = req.headers.get("user-agent", "")
            socketId = f"http_{clientHost}_{id(req)}"
            
            return await self.connectionService.trackConnection(
                socketId=socketId,
                ipAddress=clientHost,
                userAgent=userAgent
            )
                