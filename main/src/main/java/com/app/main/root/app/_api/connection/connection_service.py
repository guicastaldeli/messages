from datetime import datetime, timedelta
from typing import Dict, List, Optional, Callable, Any
import asyncio
from dataclasses import dataclass, field
from uuid import uuid4
import logging

@dataclass
class ConnectionInfo:
    socketId: str
    username: str = "Anonymous"
    ipAddress: str = ""
    userAgent: str = ""
    connectedAt: datetime = field(default_factory=datetime.now)
    disconnectedAt: Optional[datetime] = None
    isConnected: bool = True
    
    def getConnectionDuration(self) -> int:
        endTime = self.disconnectedAt or datetime.now()
        duration = endTime - self.disconnectedAt
        return int(duration.total_seconds())
    
    def getFormattedDuration(self) -> str:
        secs = self.getConnectionDuration()
        
        if(secs < 60):
            return f"{secs}s"
        elif(secs < 3600):
            mins = secs // 60
            remSecs = secs % 60
            return f"{mins}m {remSecs}s"
        else:
            hours = secs // 3600
            mins = (secs % 3600) // 60
            return f"{hours}h {mins}m"
        
class ConnectionService:
    _instance: Optional['ConnectionService'] = None
    
    def __init__(self):
        self.connections: Dict[str, ConnectionInfo] = {}
        self.connectionCallbacks: List[Callable[[ConnectionInfo], Any]] = []
        self.disconnectionCallbacks: List[Callable[[ConnectionInfo], Any]] = []
        self._lock = asyncio.Lock()
        self.logger = logging.getLogger(__name__)
        
    @classmethod
    def getInstance(cls) -> 'ConnectionService':
        if(cls._instance is None):
            cls._instance = cls()
        return cls._instance
    
    ##
    ## Track Connection
    ##
    async def trackConnection(
        self,
        socketId: str,
        ipAddress: str,
        userAgent: str = ""
    ) -> ConnectionInfo:
        async with self._lock:
            connectionInfo = ConnectionInfo(
                socketId=socketId,
                ipAddress=ipAddress,
                userAgent=userAgent
            )
            
            self.connections[socketId] = connectionInfo
            await self.notifyConnectionCallbacks(connectionInfo)
            return connectionInfo
     
    ##
    ## Track Disconnection
    ##   
    async def trackDisconnection(self, socketId: str) -> Optional[ConnectionInfo]:
        async with self._lock:
            connectionInfo = self.connections.get(socketId)
            if(connectionInfo):
                connectionInfo.disconnectedAt = datetime.now()
                connectionInfo.isConnected = False
                await self.notifyDisconnectionCallbacks(connectionInfo)
            return connectionInfo
        
    ##
    ## Update Username
    ##
    async def updateUsername(self, socketId: str, username: str) -> Optional[ConnectionInfo]:
        async with self._lock:
            connectionInfo = self.connections.get(socketId)
            if(connectionInfo):
                connectionInfo.username = username
            return connectionInfo
        
    ##
    ## Get Connection
    ##
    def getConnectionSocketId(self, socketId: str) -> Optional[ConnectionInfo]:
        return self.connections.get(socketId)
    
    ##
    ## Get All Connections
    ##
    def getAllConnections(self) -> List[ConnectionInfo]:
        return [
            conn for conn in self.connections.values()
            if(conn.isConnected)
        ]
    
    ##
    ## Get Active Connections
    ##
    def getActiveConnections(self) -> List[ConnectionInfo]:
        return [
            conn for conn in self.connections.values()
            if(conn.isConnected)
        ]
        
    ##
    ## Get Connections Count
    ##
    def getConnectionsCount(self) -> int:
        return len(self.connections)
    
    ##
    ## Get Active Connections Count
    ##
    def getActiveConnectionsCount(self) -> int:
        return len(self.getActiveConnections())
    
    ##
    ## Get Connections Ip
    ##
    async def getConnectionsIp(self, ip: str) -> List[ConnectionInfo]:
        return [
            conn for conn in self.connections.values()
            if(conn.ipAddress == ip)
        ]
        
    ##
    ## ***Callbacks
    ##
    def onConnection(self, callback: Callable[[ConnectionInfo], Any]):
        self.connectionCallbacks.append(callback)
        
    def onDisconnection(self, callback: Callable[[ConnectionInfo], Any]):
        self.disconnectionCallbacks.append(callback)
        
    ##
    ## ***Notifications
    ##
    async def notifyConnectionCallbacks(self, info: ConnectionInfo):
        for callback in self.connectionCallbacks:
            try:
                if(asyncio.iscoroutinefunction(callback)):
                    await callback(info)
                else:
                    callback(info)
            except Exception as e:
                self.logger.error(f"Error in connection callback: {e}")
                
    async def notifyDisconnectionCallbacks(self, info: ConnectionInfo):
        for callback in self.disconnectionCallbacks:
            try:
                if(asyncio.iscoroutinefunction(callback)):
                    await callback(info)
                else:
                    callback(info)
            except Exception as e:
                self.logger.error(f"Error in disconnection callback: {e}")
                
    ##
    ## Clear Old Connections
    ##
    async def clearOldConnections(self, hoursOld: int = 48):
        async with self._lock:
            cutoffTime = datetime.now() - timedelta(hours=hoursOld)
            toRemove = [
                socketId for socketId, conn in self.connections.items()
                if(not conn.isConnected and conn.disconnectedAt and conn.disconnectedAt < cutoffTime)
            ]
            for socketId in toRemove:
                del self.connections[socketId]
            if(toRemove):
                self.logger.info(f"Cleaned up {len(toRemove)} old connection(s)")