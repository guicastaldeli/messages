from enum import Enum
from typing import Dict, Any

class SessionType(Enum):
    MAIN = "main"
    DASHBOARD = "dashboard"
    
class SessionService:
    def __init__(self):
        self.sessions: Dict[str, Dict[str, Any]] = {}
        
    def getSession(self, sessionId: str) -> Dict[str, Any]:
        return self.sessions.get(sessionId, {
            "currentSession": SessionType.MAIN.value,
            "userId": None
        })
    
    def setSession(self, sessionId: str, sessionData: Dict[str, Any]):
        self.sessions[sessionId] = sessionData