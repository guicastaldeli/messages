from fastapi import APIRouter, HTTPException


router = APIRouter()

##
## All Messages
##
@router.get("/api/message-tracker/messages")
async def getMessages():
    try:
        content = await dbService.getMessages()
        return content
    except HTTPException as e:
        raise e
    except Exception as err:
        raise HTTPException(status_code=err, detail=f"Failed to load messages")
    
##
## User
##
@router.get("/api/message-tracker/messages/user/{username}")
async def getMessagesByUser(username: str):
    try:
        content = await dbService.getMessagesByUser(username)
        return content
    except HTTPException as e:
        raise e
    except Exception as err:
        raise HTTPException(status_code=err, detail=f"Failed to load messages for user {username}")

##
## Chat Id
##
@router.get("/api/message-tracker/messages/chat/{chatId}")
async def getMessagesByChatId(id: str):
    try:
        content = await dbService.getMessagesByChatId(id)
        return content
    except HTTPException as e:
        raise e
    except Exception as err:
        raise HTTPException(status_code=err, detail=f"Failed to load messages of chat {id}")

##
## Type
##
@router.get("/api/message-tracker/messages/type/{type}")
async def getMessagesByType(type: str):
    try:
        content = await dbService.getMessagesByType(type)
        return content
    except HTTPException as e:
        raise e
    except Exception as err:
        raise HTTPException(status_code=err, detail=f"Failed to load messages of type {type}")
    

##
## Direction
##
@router.get("/api/message-tracker/messages/direction/{direction}")
async def getMessagesByDirection(direction: str):
    try:
        content = await dbService.getMessagesByDirection(direction)
        return content
    except HTTPException as e:
        raise e
    except Exception as err:
        raise HTTPException(status_code=err, detail=f"Failed to load messages with direction {direction}")

##
## Recent Messages
##
@router.get("/api/message-tracker/messages/recent/{count}")
async def getRecentMessages(count: int):
    try:
        content = await dbService.getRecentMessages(count)
        return content
    except HTTPException as e:
        raise e
    except Exception as err:
        raise HTTPException(status_code=err, detail=f"Failed to load recent {count} messages")

##
## Count
##
@router.get("/api/message-tracker/messages/count")
async def getMessageCount():
    try:
        content = await dbService.getMessageCount()
        return { "count": content }
    except HTTPException as e:
        raise e
    except Exception as err:
        raise HTTPException(status_code=err, detail=f"Failed to get message count")

##
## Stats
##
@router.get("/api/message-tracker/messages/stats")
async def getMessageStats():
    try:
        content = await dbService.getMessageStats()
        return content
    except HTTPException as e:
        raise e
    except Exception as err:
        raise HTTPException(status_code=err, detail=f"Failed to get message stats")

##
## Clear
## 
@router.get("/api/message-tracker/clear")
async def clearMessages():
    try:
        res = await dbService.clearMessages()
        return { "message": res }
    except HTTPException as e:
        raise e
    except Exception as err:
        raise HTTPException(status_code=err, detail=f"Failed to clear messages")