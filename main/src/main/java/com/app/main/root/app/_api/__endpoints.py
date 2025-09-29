from fastapi import HTTPException, Query
from __main import app, dbService
from typing import Optional

@app.get("/")
async def root():
    return {
        "message": "API Server is running!",
        "endpoints": {
            "messages": "/api/messages",
            "recent_chats": "/api/recent-chats",
            "users": "/api/users/{userId}"
        }
    }
    
### Messages
@app.get("/api/messages")
async def getMessages(chatId: str = Query(..., description="Chat ID")):
    try:
        messages = await dbService.getMessagesByChatId(chatId)
        return messages
    except Exception as e:
        raise e
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    
### Recent Chats
@app.get("/api/recent-chats")
async def getRecentChats(userId: Optional[str] = Query(None)):
    try:
        chats = await dbService.getRecentChats(userId or "")
        return chats
    except HTTPException as e:
        raise e
    except HTTPException as e:
        raise HTTPException(status_code=500, detail=str(e))
    
### Users
@app.get("/api/users/{userId}")
async def getUser(userId: str):
    try:
        user = await dbService.getUserById(userId)
        return user
    except HTTPException as e:
        raise e
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

