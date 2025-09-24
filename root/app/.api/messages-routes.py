from fastapi import APIRouter, HTTPException, Request
from __main import dbService

router = APIRouter()

@router.get("/api/messages")
async def getMessages(chatId: str):
    if(not chatId):
        raise HTTPException(status_code=400, detail="chatId is required!")
    
    try:
        messages = await dbService.getMessagesByChatId(chatId)
        return messages
    except Exception as err:
        raise HTTPException(status_code=500, detail="Failed to load messages")