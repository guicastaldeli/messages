from fastapi import APIRouter, HTTPException
from message_service import MessageService

class MessageRoutes:
    messageService = MessageService()
    router = APIRouter()
    
    def __init__(messageService: MessageService):
        messageService = messageService

    ##
    ## Messages
    ##
    @router.get("/api/message-tracker/messages")
    async def getMessages(self):
        try:
            content = await self.messageService.getMessages()
            return content
        except HTTPException as e:
            raise e
        except Exception as err:
            raise HTTPException(status_code=err, detail=f"Failed to load messages")
        
    ##
    ## User
    ##
    @router.get("/api/message-tracker/messages/user/{username}")
    async def getMessagesByUser(self, username: str):
        try:
            content = await self.messageService.getMessagesByUser(username)
            return content
        except HTTPException as e:
            raise e
        except Exception as err:
            raise HTTPException(status_code=err, detail=f"Failed to load messages for user {username}")

    ##
    ## Chat Id
    ##
    @router.get("/api/message-tracker/messages/chat/{chatId}")
    async def getMessagesByChatId(self, id: str):
        try:
            content = await self.messageService.getMessagesByChatId(id)
            return content
        except HTTPException as e:
            raise e
        except Exception as err:
            raise HTTPException(status_code=err, detail=f"Failed to load messages of chat {id}")

    ##
    ## Type
    ##
    @router.get("/api/message-tracker/messages/type/{type}")
    async def getMessagesByType(self, type: str):
        try:
            content = await self.messageService.getMessagesByType(type)
            return content
        except HTTPException as e:
            raise e
        except Exception as err:
            raise HTTPException(status_code=err, detail=f"Failed to load messages of type {type}")
        

    ##
    ## Direction
    ##
    @router.get("/api/message-tracker/messages/direction/{direction}")
    async def getMessagesByDirection(self, direction: str):
        try:
            content = await self.messageService.getMessagesByDirection(direction)
            return content
        except HTTPException as e:
            raise e
        except Exception as err:
            raise HTTPException(status_code=err, detail=f"Failed to load messages with direction {direction}")

    ##
    ## Recent Messages
    ##
    @router.get("/api/message-tracker/messages/recent/{count}")
    async def getRecentMessages(self, count: int):
        try:
            content = await self.messageService.getRecentMessages(count)
            return content
        except HTTPException as e:
            raise e
        except Exception as err:
            raise HTTPException(status_code=err, detail=f"Failed to load recent {count} messages")

    ##
    ## Count
    ##
    @router.get("/api/message-tracker/messages/count")
    async def getMessageCount(self):
        try:
            content = await self.messageService.getMessageCount()
            return { "count": content }
        except HTTPException as e:
            raise e
        except Exception as err:
            raise HTTPException(status_code=err, detail=f"Failed to get message count")

    ##
    ## Stats
    ##
    @router.get("/api/message-tracker/messages/stats")
    async def getMessageStats(self):
        try:
            content = await self.messageService.getMessageStats()
            return content
        except HTTPException as e:
            raise e
        except Exception as err:
            raise HTTPException(status_code=err, detail=f"Failed to get message stats")

    ##
    ## Clear
    ## 
    @router.get("/api/message-tracker/clear")
    async def clearMessages(self):
        try:
            res = await self.messageService.clearMessages()
            return { "message": res }
        except HTTPException as e:
            raise e
        except Exception as err:
            raise HTTPException(status_code=err, detail=f"Failed to clear messages")