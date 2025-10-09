from fastapi import APIRouter, HTTPException
from __main import dbService

router = APIRouter()

@router.get("/api/recent-chats")
async def getRecentChats():
    try:
        chats = await dbService.getRecentChats()
        return chats
    except Exception as err:
        raise HTTPException(status_code=500, detail="Failed to load recent chats!")