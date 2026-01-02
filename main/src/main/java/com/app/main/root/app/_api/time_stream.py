import aiohttp
import asyncio
from datetime import datetime
from typing import Callable, Dict, Any
from threading import Event
from fastapi import APIRouter

router = APIRouter()

class TimeStream:
    def __init__(self, url: str = ""):
        self.url = url
        self.router = APIRouter()
        self.setupRoutes()
      
    ## Fetch Server Time
    async def fetchServerTime(self) -> Dict[str, Any]:
        try:
            now = datetime.now()
            return {
                "timestamp": int(now.timestamp() * 1000),
                "iso": now.isoformat(),
                "local": now.strftime("%Y-%m-%d %H:%M:%S"),
                "timezone": str(datetime.now().astimezone().tzinfo),
                "serverTime": True
            }
        except Exception as err:
            print(err)
            
    ## Formatted Time
    async def getFormattedTime(self) -> str:
        timeData = await self.fetchServerTime()
        return timeData["local"]
    
    ## Update
    async def update(
        self,
        updateCallback: Callable[[str, bool], None],
        interval: int = 1000
    ) -> Callable[[], None]:
        stopEvent = Event()
            
        # Update Loop
        async def updateLoop():
            while not stopEvent.is_set():
                try:
                    timeData = await self.fetchServerTime()
                    updateCallback(timeData["local"], timeData["serverTime"])
                except Exception as err:
                    print(f"Time update failed: {err}")
                await asyncio.sleep(interval / 1000)
                
        # Run
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        task = loop.create_task(updateLoop())
        return task
    
    ## Routes
    def setupRoutes(self):
        ## Current Time
        @self.router.get("/api/time-stream")
        async def currentTime() -> Dict[str, Any]:
            try:
                data = await self.fetchServerTime()
                return data
            except Exception as err:
                now = datetime.now()
                return {
                    "timestamp": int(now.timestamp() * 1000),
                    "iso": now.isoformat(),
                    "local": now.strftime("%Y-%m-%d %H:%M:%S"),
                    "timezone": str(datetime.now().astimezone().tzinfo),
                    "serverTime": False,
                    "error": str(err)
                }
        
        ## Formatted Time
        @self.router.get("/api/time-stream/formatted")
        async def getFormattedTime():
            data = await self.getFormattedTime()
            return data
    