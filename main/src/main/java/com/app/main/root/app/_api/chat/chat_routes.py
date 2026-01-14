from fastapi import APIRouter, HTTPException, Query, Request
from chat.chat_service import ChatService
from typing import Dict

class ChatRoutes:
    def __init__(self, service: ChatService):
        self.service = service
        self.router = APIRouter(prefix="/api/chat")
        self.setupRoutes()

    def setupRoutes(self):
        def extractCookies(req: Request) -> Dict[str, str]:
            cookies = {}
            for k, v in req.cookies.items():
                cookies[k] = v
            
            if cookies:
                print(f"[ChatRoutes] Extracted cookies: {list(cookies.keys())}")
            else:
                print(f"[ChatRoutes] WARNING: No cookies found in request!")
            
            return cookies
        
        ## Chat Data
        @self.router.get("/{chatId}/data")
        async def getChatData(
            chatId: str,
            userId: str,
            request: Request,
            page: int = Query(0, description="Page number"),
            pageSize: int = Query(20, description="Page size")
        ):
            try:
                cookies = extractCookies(request)
                
                print(f"[ChatRoutes] Getting chat data for chatId={chatId}, userId={userId}")
                
                content = await self.service.getChatData(
                    userId, 
                    chatId, 
                    page, 
                    pageSize,
                    cookies=cookies
                )
                return content
            except HTTPException as e:
                raise e
            except Exception as err:
                print(f"[ChatRoutes] Error getting chat data: {str(err)}")
                raise HTTPException(
                    status_code=500, 
                    detail=f"Failed to load chat data for {chatId}: {str(err)}"
                )
                
        ## Clear Cache
        @self.router.delete("/{chatId}/cache")
        async def clearChatCache(
            chatId: str,
            userId: str,
            request: Request
        ):
            try:
                cookies = extractCookies(request)
                
                content = await self.service.clearChatCache(
                    userId, 
                    chatId,
                    cookies=cookies
                )
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
        async def getCacheStats(
            request: Request
        ):
            try:
                cookies = extractCookies(request)
                
                content = await self.service.getCacheStats(
                    cookies=cookies
                )
                return content
            except HTTPException as e:
                raise e
            except Exception as err:
                raise HTTPException(
                    status_code=500, 
                    detail=f"Failed to get cache stats: {str(err)}"
                )