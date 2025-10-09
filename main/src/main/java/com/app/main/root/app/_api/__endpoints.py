from fastapi import HTTPException, Query
from fastapi.responses import HTMLResponse
from __main import app, dbService
from typing import Optional
from datetime import datetime

HTML = """
    <!DOCTYPE html>
    <html>
        <body>
            <div class="endpoint">
                <a href="/api/time-stream" target="_blank">/api/time-stream</a>
            </div>
            
            <div class="endpoint">
                <a href="/api/messages" target="_blank">/api/messages</a>
            </div>
            
            <div class="endpoint">
                <a href="/api/recent-chats" target="_blank">/api/recent-chats</a>
            </div>
            
            <div class="endpoint">
                <a href="/api/users/user" target="_blank">/api/users/user</a>
            </div>
        </body>
    </html>
"""

@app.get("/", response_class=HTMLResponse)
async def root():
    return HTML

### Time Stream
@app.get("/api/time-stream")
async def getTimeStream():
    try:
        now = datetime.now()
        return {
            "timestamp": int(now.timestamp() * 1000),
            "iso": now.isoformat(),
            "local": now.strftime("%Y-%m-%d %H:%M:%S"),
            "timezone": str(now.astimezone().tzinfo),
            "serverTime": True
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    
### Messages
@app.get("/api/messages")
async def getMessages():
    try:
        messages = await dbService.getMessages()
        return messages
    except Exception as e:
        raise e
    except Exception as e:
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

