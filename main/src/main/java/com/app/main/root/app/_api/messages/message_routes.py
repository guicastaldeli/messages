from fastapi import APIRouter, HTTPException, Query, Path
from messages.message_service import MessageService

class MessageRoutes:        
    def __init__(self, service: MessageService):
        self.service = service
        self.router = APIRouter(prefix="/api/message")
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
            
        ## Messages
        @self.router.get("/get-messages")
        async def getMessages():
            try:
                content = await self.service.getMessages()
                return content
            except HTTPException as e:
                raise e
            except Exception as err:
                raise HTTPException(status_code=err, detail=f"Failed to load messages")

        ## Chat Id
        @self.router.get("/messages/chatId/{chatId}")
        async def getMessagesByChatId(
            chatId: str,
            page: int = Query(0, description="Page number"),
            pageSize: int = Query(20, description="Page size")
        ):
            try:
                content = await self.service.getMessagesByChatId(chatId, page, pageSize)
                return content
            except HTTPException as e:
                raise e
            except Exception as err:
                raise HTTPException(
                    status_code=err, 
                    detail=f"Failed to load messages for chat {chatId}: {str(err)}"
                )
            
        @self.router.get("/messages/chatId/{chatId}/count")
        async def getMessageCountByChatId(chatId: str):
            try:
                content = await self.service.getMessagesCountByChatId(chatId)
                return content
            except HTTPException as e:
                raise e
            except Exception as err:
                raise HTTPException(
                    status_code=err, 
                    detail=f"Failed to load message count for chat {chatId}: {str(err)}"
                )

        ## Recent Messages
        @self.router.get("/messages/recent/{userId}")
        async def getRecentChats(
            userId: str = Path(..., description="User ID"),
            page: int = Query(0, description="Page number"),
            pageSize: int = Query(20, description="Page size")
        ):
            try:
                content = await self.service.getRecentChats(userId, page, pageSize)
                return content
            except HTTPException as e:
                raise e
            except Exception as err:
                raise HTTPException(
                    status_code=err, 
                    detail=f"Failed to load recent messages for {userId}: {str(err)}"
                )
                
        @self.router.get("/messages/recent/{userId}/count")
        async def getRecentChatsCount(userId: str = Path(..., description="User ID")):
            try:
                content = await self.service.getRecentChatsCount(userId)
                return content
            except HTTPException as e:
                raise e
            except Exception as err:
                raise HTTPException(
                    status_code=err, 
                    detail=f"Failed to load recent message count for {userId}: {str(err)}"
                )
            
        ## User
        @self.router.get("/messages/userId/{userId}")
        async def getMessagesByUserId(userId: str = Path(..., description="User ID")):
            try:
                content = await self.service.getMessagesByUserId(userId)
                return content
            except HTTPException as e:
                raise e
            except Exception as err:
                raise HTTPException(
                    status_code=err, 
                    detail=f"Failed to load messages for user {userId}"
                )

        ## Count
        @self.router.get("/count")
        async def getMessageCount():
            try:
                content = await self.service.getMessageCount()
                return { "count": content }
            except HTTPException as e:
                raise e
            except Exception as err:
                raise HTTPException(status_code=err, detail=f"Failed to get message count")

        ## Stats
        @self.router.get("/stats")
        async def getMessageStats():
            try:
                content = await self.service.getMessageStats()
                return content
            except HTTPException as e:
                raise e
            except Exception as err:
                raise HTTPException(status_code=err, detail=f"Failed to get message stats")

        ## Clear
        @self.router.delete("/clear")
        async def clearMessages():
            try:
                res = await self.service.clearMessages()
                return { "message": res }
            except HTTPException as e:
                raise e
            except Exception as err:
                raise HTTPException(status_code=err, detail=f"Failed to clear messages")