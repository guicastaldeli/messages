from fastapi import HTTPException
from routes import MessageRoutes
import httpx

class MessageService:
    def __init__(self, url: str):
        self.base_url = url
        MessageRoutes(self)
    
    ##
    ## Messgaes
    ##
    async def getMessages(self) -> list:
        async with httpx.AsyncClient() as client:
            res = await client.get(f"{self.base_url}/api/message-tracker/messages")
            if(res.status_code != 200):
                raise HTTPException(status_code=res.status_code, detail=res.json())
            return res.json()
        
    ##
    ## User
    ##
    async def getMessagesByUser(self, username: str) -> list:
        async with httpx.AsyncClient() as client:
            res = await client.get(f"{self.base_url}/api/message-tracker/messages/user/{username}")
            if(res.status_code != 200):
                raise HTTPException(status_code=res.status_code, detail=res.json())
            return res.json()
        
    ##
    ## Chat
    ##
    async def getMessagesByChatId(self, id: str) -> list:
        async with httpx.AsyncClient() as client:
            res = await client.get(f"{self.base_url}/api/message-tracker/messages/chat/{id}")
            if(res.status_code != 200):
                raise HTTPException(status_code=res.status_code, detail=res.json())
            return res.json()
    
    
    ##
    ## Type
    ##
    async def getMessagesByType(self, type: str) -> list:
        async with httpx.AsyncClient() as client:
            res = await client.get(f"{self.base_url}/api/message-tracker/messages/type/{type}")
            if(res.status_code != 200):
                raise HTTPException(status_code=res.status_code, detail=res.json())
            return res.json()
        
    ##
    ## Direction
    ##
    async def getMessagesByDirection(self, direction: str) -> list:
        async with httpx.AsyncClient() as client:
            res = await client.get(f"{self.base_url}/api/message-tracker/messages/direction/{direction}")
            if(res.status_code != 200):
                raise HTTPException(status_code=res.status_code, detail=res.json())
            return res.json()
        
    ##
    ## Recent
    ##
    async def getRecentMessages(self, count: str) -> list:
        async with httpx.AsyncClient() as client:
            res = await client.get(f"{self.base_url}/api/message-tracker/messages/recent/{count}")
            if(res.status_code != 200):
                raise HTTPException(status_code=res.status_code, detail=res.json())
            return res.json()
        
    ##
    ## Count
    ##
    async def getMessageCount(self) -> list:
        async with httpx.AsyncClient() as client:
            res = await client.get(f"{self.base_url}/api/message-tracker/count")
            if(res.status_code != 200):
                raise HTTPException(status_code=res.status_code, detail=res.json())
            return res.json()
        
    ##
    ## Stats
    ##
    async def getMessageStats(self) -> list:
        async with httpx.AsyncClient() as client:
            res = await client.get(f"{self.base_url}/api/message-tracker/stats")
            if(res.status_code != 200):
                raise HTTPException(status_code=res.status_code, detail=res.json())
            return res.json()
        
    ##
    ## Clear
    ##
    async def clearMessages(self) -> list:
        async with httpx.AsyncClient() as client:
            res = await client.get(f"{self.base_url}/api/message-tracker/clear")
            if(res.status_code != 200):
                raise HTTPException(status_code=res.status_code, detail=res.json())
            return res.json()