from fastapi import APIRouter, HTTPException
from messages.message_service import MessageService

class MessageRoutes:        
    def __init__(self, service: MessageService):
        self.service = service
        self.router = APIRouter(prefix="/api/message-tracker")
        self.setupRoutes()

    def setupRoutes(self):
        ##
        ## Messages
        ##
        @self.router.get("/messages")
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
        async def getMessagesByUser(username: str):
            try:
                content = await self.service.getMessagesByUser(username)
                return content
            except HTTPException as e:
                raise e
            except Exception as err:
                raise HTTPException(status_code=err, detail=f"Failed to load messages for user {username}")

        ##
        ## Chat Id
        ##
        @self.router.get("/messages/chat/{chatId}")
        async def getMessagesByChatId(id: str):
            try:
                content = await self.service.getMessagesByChatId(id)
                return content
            except HTTPException as e:
                raise e
            except Exception as err:
                raise HTTPException(status_code=err, detail=f"Failed to load messages of chat {id}")

        ##
        ## Type
        ##
        @self.router.get("/messages/type/{type}")
        async def getMessagesByType(type: str):
            try:
                content = await self.service.getMessagesByType(type)
                return content
            except HTTPException as e:
                raise e
            except Exception as err:
                raise HTTPException(status_code=err, detail=f"Failed to load messages of type {type}")
            

        ##
        ## Direction
        ##
        @self.router.get("/messages/direction/{direction}")
        async def getMessagesByDirection(direction: str):
            try:
                content = await self.service.getMessagesByDirection(direction)
                return content
            except HTTPException as e:
                raise e
            except Exception as err:
                raise HTTPException(status_code=err, detail=f"Failed to load messages with direction {direction}")

        ##
        ## Recent Messages
        ##
        @self.router.get("/messages/recent/{count}")
        async def getRecentMessages(count: int):
            try:
                content = await self.service.getRecentMessages(count)
                return content
            except HTTPException as e:
                raise e
            except Exception as err:
                raise HTTPException(status_code=err, detail=f"Failed to load recent {count} messages")

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
        @self.router.get("/clear")
        async def clearMessages():
            try:
                res = await self.service.clearMessages()
                return { "message": res }
            except HTTPException as e:
                raise e
            except Exception as err:
                raise HTTPException(status_code=err, detail=f"Failed to clear messages")