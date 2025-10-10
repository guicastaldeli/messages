from fastapi import APIRouter, HTTPException
from session.session_service import SessionService

class SessionRoutes:
    def __init__(self, service: SessionService):
        self.service = service
        self.router = APIRouter(prefix="/api/session")
        self.setupRoutes()
        
    def setupRoutes(self):
        ##
        ## Get Session
        ##
        @self.router.get("/{userId}")
        async def getSession(userId: str):
            try:
                session = await self.service.getSession(userId)
                return session
            except HTTPException as e:
                raise e
            except Exception as err:
                raise HTTPException(status_code=err, detail="Failed to get session")
            
        ##
        ## Stats
        ##
        @self.router.get("/stats")
        async def getSessionStats():
            try:
                stats = await self.service.getSessionStats()
                return stats
            except HTTPException as e:
                raise e
            except Exception as err:
                raise HTTPException(status_code=err, detail="Failed to get session stats")
            
        ##
        ## Active
        ##
        @self.router.get("/active")
        async def getActiveSessions():
            try:
                session = await self.service.getActiveSessions()
                return session
            except HTTPException as e:
                raise e
            except Exception as err:
                raise HTTPException(status_code=err, detail="Failed to get active sessions")
            
        ##
        ## Update Session Type
        ##
        @self.router.put("/{userId}/type")
        async def updateSessionType(userId: str, sessionType: str):
            try:
                session = await self.service.updateSessionType(userId, sessionType)
                return session
            except HTTPException as e:
                raise e
            except Exception as err:
                raise HTTPException(status_code=err, detail="Failed to update session type")
            
        ##
        ## Update Session
        ##
        @self.router.post("/update")
        async def updateSession(
            userId: str,
            username: str,
            sessionType: str
        ):
            try:
                result = await self.service.updateSession(userId, username, sessionType)
                return result
            except HTTPException as e:
                raise e
            except Exception as err:
                raise HTTPException(status_code=err, detail="Failed to update session type")