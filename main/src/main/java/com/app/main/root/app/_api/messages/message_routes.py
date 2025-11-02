from fastapi import APIRouter, HTTPException
from messages.message_service import MessageService

class MessageRoutes:        
    def __init__(self, service: MessageService):
        self.service = service
        self.router = APIRouter(prefix="/api/message-tracker")
        self.setupRoutes()

    def setupRoutes(self):
        @self.router.post("/messages")
        async def saveMessages(data: dict):
            try:
                content = await self.service.saveMessages(data)
                return content
            except HTTPException as e:
                raise e
            except Exception as err:
                raise HTTPException(status_code=err, detail=f"Failed to load messages: {str(err)}")
            
        ##
        ## Messages
        ##
        @self.router.get("/get-messages")
        async def getMessages():
            try:
                content = await self.service.getMessages()
                return content
            except HTTPException as e:
                raise e
            except Exception as err:
                raise HTTPException(status_code=err, detail=f"Failed to load messages")
            
        ##
        ## User
        ##
        @self.router.get("/messages/user/{username}")
        async def getMessagesByUsername(username: str):
            try:
                content = await self.service.getMessagesByUsername(username)
                return content
            except HTTPException as e:
                raise e
            except Exception as err:
                raise HTTPException(status_code=err, detail=f"Failed to load messages for user {username}")

        ##
        ## Chat Id
        ##
        @self.router.get("/messages/chatId/{chatId}")
        async def getMessagesByChatId(chatId: str):
            try:
                content = await self.service.getMessagesByChatId(chatId)
                return content
            except HTTPException as e:
                raise e
            except Exception as err:
                raise HTTPException(status_code=err, detail=f"Failed to load messages of chat {chatId}")

        ##
        ## Recent Messages
        ##
        @self.router.get("/messages/recent/{userId}/{count}")
        async def getRecentMessages(userId: str, count: int):
            try:
                content = await self.service.getRecentMessages(userId, count)
                return content
            except HTTPException as e:
                raise e
            except Exception as err:
                raise HTTPException(status_code=err, detail=f"Failed to load recent {count} messages of {userId}")

        ##
        ## Count
        ##
        @self.router.get("/count")
        async def getMessageCount():
            try:
                content = await self.service.getMessageCount()
                return { "count": content }
            except HTTPException as e:
                raise e
            except Exception as err:
                raise HTTPException(status_code=err, detail=f"Failed to get message count")

        ##
        ## Stats
        ##
        @self.router.get("/stats")
        async def getMessageStats():
            try:
                content = await self.service.getMessageStats()
                return content
            except HTTPException as e:
                raise e
            except Exception as err:
                raise HTTPException(status_code=err, detail=f"Failed to get message stats")

        ##
        ## Clear
        ## 
        @self.router.delete("/clear")
        async def clearMessages():
            try:
                res = await self.service.clearMessages()
                return { "message": res }
            except HTTPException as e:
                raise e
            except Exception as err:
                raise HTTPException(status_code=err, detail=f"Failed to clear messages")