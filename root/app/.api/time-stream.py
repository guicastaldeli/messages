import aiohttp
import asyncio
from datetime import datetime
from typing import Callable, Dict, Any
import json
import threading
from threading import Event

class TimeStream:
    def __init__(self, url: str = ""):
        self.url = url
      
    ##  
    ## Fetch Server Time
    async def fetchServerTime(self) -> Dict[str, Any]:
        try:
            async with aiohttp.ClientSession() as session:
                async with session.get(
                    f"{self.url}/.api/time-stream?_={int(datetime.now().timestamp() * 1000)}"
                ) as res:
                    if(res.status != 200):
                        raise Exception("Time API not avaliable!")
                    return await res.json()
        except Exception as err:
            now = datetime.now()
            return {
                "timestamp": int(now.timestamp() * 1000),
                "iso": now.isoformat(),
                "local": now.strftime("%Y-%m-%d %H:%M:%S"),
                "timezone": str(datetime.now().astimezone().tzinfo),
                "serverTime": False
            }
            
    ##
    ## Formatted Time
    async def getFormattedTime(self) -> str:
        timeData = await self.fetchServerTime()
        return timeData["local"]
    
    ##
    ## Time Update
    def timeUpdate(
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