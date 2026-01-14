from fastapi import HTTPException, Request
import httpx
import asyncio
from typing import Dict, Optional, List, Any

class MessageService:
    def __init__(self, url: str):
        self.base_url = url
    
    ## Save Messages
    async def saveMessages(
        self, 
        data: Dict[str, Any],
        cookies: Optional[Dict[str, str]] = None
    ) -> dict:
        return await self._request(
            "post", 
            "/api/message/messages",
            json=data,
            cookies=cookies
        )
    
    ## Get Tracked Messages
    async def getTrackedMessages(
        self,
        cookies: Optional[Dict[str, str]] = None
    ) -> List[dict]:
        return await self._request(
            "get", 
            "/api/message/get-messages",
            cookies=cookies
        )
    
    ## Decrypt Message
    async def decryptMessage(
        self, 
        message_id: str, 
        data: Any,
        cookies: Optional[Dict[str, str]] = None
    ) -> dict:
        return await self._request(
            "post", 
            f"/api/message/decrypt/{message_id}",
            json=data,
            cookies=cookies
        )
    
    ## Get Message Count by Chat Id
    async def getMessageCountByChatId(
        self, 
        chat_id: str,
        cookies: Optional[Dict[str, str]] = None
    ) -> int:
        result = await self._request(
            "get", 
            f"/api/message/messages/chatId/{chat_id}/count",
            cookies=cookies
        )
        return result if isinstance(result, int) else result.get('count', 0)
    
    ## Get Recent Messages
    async def getRecentMessages(
        self, 
        user_id: str, 
        page: int = 0, 
        page_size: int = 20,
        cookies: Optional[Dict[str, str]] = None
    ) -> dict:
        try:
            print(f"[MessageService] Fetching recent messages for userId={user_id}, page={page}")
            
            result = await self._request_with_retry(
                "get", 
                f"/api/message/messages/recent/{user_id}?page={page}&pageSize={page_size}",
                cookies=cookies,
                max_retries=2,
                timeout=10.0
            )
            
            return result
        except Exception as err:
            print(f"[MessageService] Error fetching recent messages: {str(err)}")
            return {
                'chats': [],
                'page': page,
                'pageSize': page_size,
                'total': 0,
                'hasMore': False
            }
    
    ## Get Recent Chats Count
    async def getRecentChatsCount(
        self, 
        user_id: str,
        cookies: Optional[Dict[str, str]] = None
    ) -> int:
        try:
            result = await self._request(
                "get", 
                f"/api/message/messages/recent/{user_id}/count",
                cookies=cookies
            )
            return result.get('count', 0) if isinstance(result, dict) else result
        except Exception as err:
            print(f"[MessageService] Error fetching recent chats count: {str(err)}")
            return 0
    
    ## Get Messages By Chat Id
    async def getMessagesByChatId(
        self, 
        chat_id: str, 
        page: int = 0, 
        page_size: int = 20,
        cookies: Optional[Dict[str, str]] = None
    ) -> List[dict]:
        return await self._request(
            "get", 
            f"/api/message/messages/chatId/{chat_id}?page={page}&pageSize={page_size}",
            cookies=cookies
        )
    
    ## Get Messages By User Id
    async def getMessagesByUserId(
        self, 
        user_id: str,
        cookies: Optional[Dict[str, str]] = None
    ) -> List[dict]:
        return await self._request(
            "get", 
            f"/api/message/messages/userId/{user_id}",
            cookies=cookies
        )
    
    ## Get Messages Stats
    async def getMessagesStats(
        self,
        cookies: Optional[Dict[str, str]] = None
    ) -> List[dict]:
        return await self._request(
            "get", 
            "/api/message/stats",
            cookies=cookies
        )
    
    ## Get Messages By Chat Id And User Id
    async def getMessagesByChatIdAndUserId(
        self, 
        chat_id: str, 
        user_id: str,
        cookies: Optional[Dict[str, str]] = None
    ) -> List[dict]:
        return await self._request(
            "get", 
            f"/api/message/messages/chatId/{chat_id}/userId/{user_id}",
            cookies=cookies
        )
    
    ## Get Messages By Type
    async def getMessagesByType(
        self, 
        message_type: str,
        cookies: Optional[Dict[str, str]] = None
    ) -> List[dict]:
        return await self._request(
            "get", 
            f"/api/message/messages/type/{message_type}",
            cookies=cookies
        )
    
    ## Delete Message
    async def deleteMessage(
        self, 
        message_id: str,
        cookies: Optional[Dict[str, str]] = None
    ) -> dict:
        return await self._request(
            "delete", 
            f"/api/message/messages/{message_id}",
            cookies=cookies
        )
    
    ## Update Message
    async def updateMessage(
        self, 
        message_id: str, 
        content: str,
        cookies: Optional[Dict[str, str]] = None
    ) -> dict:
        return await self._request(
            "put", 
            f"/api/message/messages/{message_id}",
            json={"content": content},
            cookies=cookies
        )
    
    ## Mark Message as Read
    async def markMessageAsRead(
        self, 
        message_id: str,
        cookies: Optional[Dict[str, str]] = None
    ) -> dict:
        return await self._request(
            "post", 
            f"/api/message/messages/{message_id}/read",
            cookies=cookies
        )
    
    ## Mark Messages as Read
    async def markMessagesAsRead(
        self, 
        message_ids: List[str],
        cookies: Optional[Dict[str, str]] = None
    ) -> dict:
        return await self._request(
            "post", 
            "/api/message/messages/read",
            json={"messageIds": message_ids},
            cookies=cookies
        )
    
    ## Get Unread Messages Count
    async def getUnreadMessagesCount(
        self, 
        user_id: str,
        cookies: Optional[Dict[str, str]] = None
    ) -> int:
        result = await self._request(
            "get", 
            f"/api/message/messages/unread/count/{user_id}",
            cookies=cookies
        )
        return result.get('count', 0) if isinstance(result, dict) else result
    
    async def _request_with_retry(
        self, 
        method: str, 
        path: str, 
        json=None,
        cookies: Optional[Dict[str, str]] = None,
        max_retries: int = 2,
        timeout: float = 10.0
    ):
        """Request with retry logic for handling concurrent requests"""
        last_error = None
        
        for attempt in range(max_retries + 1):
            try:
                return await self._request(
                    method, 
                    path, 
                    json=json,
                    cookies=cookies,
                    timeout=timeout
                )
            except HTTPException as e:
                last_error = e
                if e.status_code == 403 or e.status_code == 401:
                    raise
                if attempt < max_retries:
                    print(f"[MessageService] Retry {attempt + 1}/{max_retries} for {path}")
                    await asyncio.sleep(0.1 * (attempt + 1))
                    continue
                raise
            except Exception as e:
                last_error = e
                if attempt < max_retries:
                    print(f"[MessageService] Retry {attempt + 1}/{max_retries} after error: {str(e)}")
                    await asyncio.sleep(0.1 * (attempt + 1))
                    continue
                raise
        
        if last_error:
            raise last_error
        raise HTTPException(status_code=500, detail="Request failed after retries")
    
    async def _request(
        self, 
        method: str, 
        path: str, 
        json=None,
        cookies: Optional[Dict[str, str]] = None,
        timeout: float = 10.0
    ):
        async with httpx.AsyncClient(timeout=timeout) as client:
            url = f"{self.base_url}{path}"
            
            if cookies:
                print(f"[MessageService] Sending cookies to {url}: {list(cookies.keys())}")
            else:
                print(f"[MessageService] WARNING: No cookies to send to {url}")
            
            res = await client.request(
                method, 
                url, 
                json=json,
                cookies=cookies,
                follow_redirects=True
            )
            
            if res.status_code != 200:
                error_text = res.text
                print(f"[MessageService] Request failed with status {res.status_code}: {error_text}")
                raise HTTPException(status_code=res.status_code, detail=error_text)
            
            return res.json()