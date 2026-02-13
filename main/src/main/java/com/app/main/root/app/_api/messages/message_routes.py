from fastapi import APIRouter, HTTPException, Query, Request
from messages.message_service import MessageService
from typing import Dict, List, Any

class MessageRoutes:
    def __init__(self, service: MessageService):
        self.service = service
        self.router = APIRouter(prefix="/api/message")
        self.setupRoutes()

    def setupRoutes(self):
        def extractCookies(req: Request) -> Dict[str, str]:
            cookies = {}
            for k, v in req.cookies.items():
                cookies[k] = v
            
            if cookies:
                print(f"[MessageRoutes] Extracted cookies: {list(cookies.keys())}")
            else:
                print(f"[MessageRoutes] WARNING: No cookies found in request!")
            
            return cookies
        
        ## Save Messages
        @self.router.post("/messages")
        async def saveMessages(
            data: Dict[str, Any],
            request: Request
        ):
            try:
                cookies = extractCookies(request)
                result = await self.service.saveMessages(data, cookies=cookies)
                return result
            except HTTPException as e:
                raise e
            except Exception as err:
                raise HTTPException(
                    status_code=500,
                    detail=f"Failed to save messages: {str(err)}"
                )
        
        ## Get Tracked Messages
        @self.router.get("/get-messages")
        async def getTrackedMessages(request: Request):
            try:
                cookies = extractCookies(request)
                messages = await self.service.getTrackedMessages(cookies=cookies)
                return messages
            except HTTPException as e:
                raise e
            except Exception as err:
                raise HTTPException(
                    status_code=500,
                    detail=f"Failed to get tracked messages: {str(err)}"
                )
        
        ## Get Message Count by Chat Id
        @self.router.get("/messages/chatId/{chat_id}/count")
        async def getMessageCountByChatId(
            chat_id: str,
            request: Request
        ):
            try:
                cookies = extractCookies(request)
                count = await self.service.getMessageCountByChatId(chat_id, cookies=cookies)
                return count
            except HTTPException as e:
                raise e
            except Exception as err:
                raise HTTPException(
                    status_code=500,
                    detail=f"Failed to get message count: {str(err)}"
                )
        
        ## Get Recent Messages
        @self.router.get("/messages/recent/{user_id}")
        async def getRecentMessages(
            user_id: str,
            request: Request,
            page: int = Query(0, description="Page number"),
            pageSize: int = Query(20, description="Page size")
        ):
            try:
                cookies = extractCookies(request)
                
                print(f"[MessageRoutes] Getting recent messages for userId={user_id}, page={page}, pageSize={pageSize}")
                
                messages = await self.service.getRecentMessages(
                    user_id, 
                    page, 
                    pageSize,
                    cookies=cookies
                )
                return messages
            except HTTPException as e:
                raise e
            except Exception as err:
                print(f"[MessageRoutes] Error getting recent messages: {str(err)}")
                raise HTTPException(
                    status_code=500,
                    detail=f"Failed to get recent messages: {str(err)}"
                )
        
        ## Get Recent Chats Count
        @self.router.get("/messages/recent/{user_id}/count")
        async def getRecentChatsCount(
            user_id: str,
            request: Request
        ):
            try:
                cookies = extractCookies(request)
                count = await self.service.getRecentChatsCount(user_id, cookies=cookies)
                return {"count": count}
            except HTTPException as e:
                raise e
            except Exception as err:
                raise HTTPException(
                    status_code=500,
                    detail=f"Failed to get recent chats count: {str(err)}"
                )
        
        ## Get Messages By Chat Id
        @self.router.get("/messages/chatId/{chat_id}")
        async def getMessagesByChatId(
            chat_id: str,
            request: Request,
            page: int = Query(0, description="Page number"),
            pageSize: int = Query(20, description="Page size")
        ):
            try:
                cookies = extractCookies(request)
                messages = await self.service.getMessagesByChatId(
                    chat_id, 
                    page, 
                    pageSize,
                    cookies=cookies
                )
                return messages
            except HTTPException as e:
                raise e
            except Exception as err:
                raise HTTPException(
                    status_code=500,
                    detail=f"Failed to get messages by chat ID: {str(err)}"
                )
        
        ## Get Messages By User Id
        @self.router.get("/messages/userId/{user_id}")
        async def getMessagesByUserId(
            user_id: str,
            request: Request
        ):
            try:
                cookies = extractCookies(request)
                messages = await self.service.getMessagesByUserId(user_id, cookies=cookies)
                return messages
            except HTTPException as e:
                raise e
            except Exception as err:
                raise HTTPException(
                    status_code=500,
                    detail=f"Failed to get user messages: {str(err)}"
                )
        
        ## Get Messages Stats
        @self.router.get("/stats")
        async def getMessagesStats(request: Request):
            try:
                cookies = extractCookies(request)
                stats = await self.service.getMessagesStats(cookies=cookies)
                return stats
            except HTTPException as e:
                raise e
            except Exception as err:
                raise HTTPException(
                    status_code=500,
                    detail=f"Failed to get message stats: {str(err)}"
                )
        
        ## Get Messages By Chat Id And User Id
        @self.router.get("/messages/chatId/{chat_id}/userId/{user_id}")
        async def getMessagesByChatIdAndUserId(
            chat_id: str,
            user_id: str,
            request: Request
        ):
            try:
                cookies = extractCookies(request)
                messages = await self.service.getMessagesByChatIdAndUserId(
                    chat_id, 
                    user_id,
                    cookies=cookies
                )
                return messages
            except HTTPException as e:
                raise e
            except Exception as err:
                raise HTTPException(
                    status_code=500,
                    detail=f"Failed to get messages: {str(err)}"
                )
        
        ## Get Messages By Type
        @self.router.get("/messages/type/{message_type}")
        async def getMessagesByType(
            message_type: str,
            request: Request
        ):
            try:
                cookies = extractCookies(request)
                messages = await self.service.getMessagesByType(message_type, cookies=cookies)
                return messages
            except HTTPException as e:
                raise e
            except Exception as err:
                raise HTTPException(
                    status_code=500,
                    detail=f"Failed to get messages by type: {str(err)}"
                )
        
        ## Delete Message
        @self.router.delete("/messages/{message_id}")
        async def deleteMessage(
            message_id: str,
            request: Request
        ):
            try:
                cookies = extractCookies(request)
                result = await self.service.deleteMessage(message_id, cookies=cookies)
                return result
            except HTTPException as e:
                raise e
            except Exception as err:
                raise HTTPException(
                    status_code=500,
                    detail=f"Failed to delete message: {str(err)}"
                )
        
        ## Update Message
        @self.router.put("/messages/{message_id}")
        async def updateMessage(
            message_id: str,
            data: Dict[str, str],
            request: Request
        ):
            try:
                cookies = extractCookies(request)
                content = data.get("content", "")
                result = await self.service.updateMessage(message_id, content, cookies=cookies)
                return result
            except HTTPException as e:
                raise e
            except Exception as err:
                raise HTTPException(
                    status_code=500,
                    detail=f"Failed to update message: {str(err)}"
                )
        
        ## Mark Message as Read
        @self.router.post("/messages/{message_id}/read")
        async def markMessageAsRead(
            message_id: str,
            request: Request
        ):
            try:
                cookies = extractCookies(request)
                result = await self.service.markMessageAsRead(message_id, cookies=cookies)
                return result
            except HTTPException as e:
                raise e
            except Exception as err:
                raise HTTPException(
                    status_code=500,
                    detail=f"Failed to mark message as read: {str(err)}"
                )
        
        ## Mark Messages as Read
        @self.router.post("/messages/read")
        async def markMessagesAsRead(
            data: Dict[str, List[str]],
            request: Request
        ):
            try:
                cookies = extractCookies(request)
                message_ids = data.get("messageIds", [])
                result = await self.service.markMessagesAsRead(message_ids, cookies=cookies)
                return result
            except HTTPException as e:
                raise e
            except Exception as err:
                raise HTTPException(
                    status_code=500,
                    detail=f"Failed to mark messages as read: {str(err)}"
                )
        
        ## Get Unread Messages Count
        @self.router.get("/messages/unread/count/{user_id}")
        async def getUnreadMessagesCount(
            user_id: str,
            request: Request
        ):
            try:
                cookies = extractCookies(request)
                count = await self.service.getUnreadMessagesCount(user_id, cookies=cookies)
                return {"count": count}
            except HTTPException as e:
                raise e
            except Exception as err:
                raise HTTPException(
                    status_code=500,
                    detail=f"Failed to get unread count: {str(err)}"
                )