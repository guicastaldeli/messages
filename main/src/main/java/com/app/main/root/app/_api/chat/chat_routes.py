from fastapi import APIRouter, HTTPException, Query, Path
from chat.chat_service import ChatService

class ChatRoutes:
    def __init__(self, service: ChatService):
        self.service = service
        self.router = APIRouter(prefix="/api/chat")
        self.setupRoutes()

    def setupRoutes(self):
        ## Chat Data
        @self.router.get("/{chatId}/data")
        async def getChatData(
            chatId: str,
            userId: str,
            page: int = Query(0, description="Page number"),
            pageSize: int = Query(20, description="Page size")
        ):
            try:
                content = await self.service.getChatData(userId, chatId, page, pageSize)
                return content
            except HTTPException as e:
                raise e
            except Exception as err:
                raise HTTPException(
                    status_code=500, 
                    detail=f"Failed to load chat data for {chatId}: {str(err)}"
                )
                
        ## Clear Cache
        @self.router.delete("/{chatId}/cache")
        async def clearChatCache(
            chatId: str,
            userId: str
        ):
            try:
                content = await self.service.clearChatCache(userId, chatId)
                return content
            except HTTPException as e:
                raise e
            except Exception as err:
                raise HTTPException(
                    status_code=500, 
                    detail=f"Failed to clear cache for chat {chatId}: {str(err)}"
                )
                
        ## Cache Stats
        @self.router.get("/cache/stats")
        async def getCacheStats():
            try:
                content = await self.service.getCacheStats()
                return content
            except HTTPException as e:
                raise e
            except Exception as err:
                raise HTTPException(
                    status_code=500, 
                    detail=f"Failed to get cache stats: {str(err)}"
                )