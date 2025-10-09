from fastapi import APIRouter
from fastapi.responses import HTMLResponse

router = APIRouter()

contentHTML = """
    <!DOCTYPE html>
    <html>
        <body>
            <div class="endpoint">
                <a href="/api/time-stream" target="_blank">Time</a>
            </div>
            <div class="endpoint">
                <a href="/api/message-tracker/messages" target="_blank">Tracked Messages</a>
            </div>
            
            <div class="message-tracker-section">
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

@router.get("/", response_class=HTMLResponse)
async def root():
    return contentHTML

