from fastapi import HTTPException
from fastapi.responses import HTMLResponse
from __main import app, messageService
from datetime import datetime

HTML = """
    <!DOCTYPE html>
    <html>
        <body>
            <div class="endpoint">
                <a href="/api/time-stream" target="_blank">Time</a>
            </div>
            <div class="endpoint">
                <a href="/api/messages" target="_blank">Messages</a>
            </div>
            
            <div class="message-tracker-section">
                <div class="endpoint">
                    <a href="/api/message-tracker/messages" target="_blank">Tracked Messages</a>
                </div>
                <div class="endpoint">
                    <a href="/api/message-tracker/stats" target="_blank">Stats</a>
                </div>
                <div class="endpoint">
                    <a href="/api/message-tracker/count" target="_blank">Count</a>
                </div>
                <div class="endpoint">
                    <a href="/api/message-tracker/messages/recent/0" target="_blank">Recent Messages (URL NUMBER)</a>
                </div>
                <div class="endpoint">
                    By Type
                    <a href="/api/message-tracker/messages/type/DIRECT" target="_blank">DIRECT</a>
                    <a href="/api/message-tracker/messages/type/GROUP" target="_blank">GROUP</a>
                </div>
                <div class="endpoint">
                    By Direction
                    <a href="/api/message-tracker/messages/direction/SENT" target="_blank">SENT</a>
                    <a href="/api/message-tracker/messages/direction/RECEIVED" target="_blank">RECEIVED</a>
                </div>
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
        messages = await messageService.getMessages()
        return messages
    except Exception as e:
        raise e
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

