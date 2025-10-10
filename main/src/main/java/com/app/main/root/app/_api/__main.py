from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from time_stream import TimeStream
from messages.message_service import MessageService
from messages.message_routes import MessageRoutes
from session.session_service import SessionService
from session.session_routes import SessionRoutes
from __index import router as router
import os

class Main:
    app = FastAPI()
    
    def __init__(self):
        self.app.add_middleware(
            CORSMiddleware,
            allow_origins=["http://localhost:3000", "http://localhost:3001"],
            allow_methods=["*"],
            allow_headers=["*"]
        )
        DB_API_URL = os.getenv(
            'DB_API_URL',
            'http://localhost:3001'
        )
        TIME_API_URL = os.getenv(
            'TIME_API_URL',
            'http://localhost:3001'
        )
        SESSION_API_URL = os.getenv(
            'SESSION_API_URL',
            'http://localhost:3001'
        )
        
        ## Router
        self.app.include_router(router)
        
        ## Time
        self.timeStream = TimeStream(TIME_API_URL)
        self.app.include_router(self.timeStream.router)
        
        ## Session
        self.sessionService = SessionService(SESSION_API_URL)
        self.sessionRoutes = SessionRoutes(self.sessionService)
        self.app.include_router(self.sessionRoutes.router)
        
        ## Message
        self.messageService = MessageService(DB_API_URL)
        self.messageRoutes = MessageRoutes(self.messageService)
        self.app.include_router(self.messageRoutes.router)
        

#Init
instance = Main()
app = instance.app
timeStream = instance.timeStream
messageService = instance.messageService

def timeCallback(time: str, serverTime: bool):
    print(f"Time: {time}")

@app.on_event("startup")
async def startTimeUpdates():
    await timeStream.update(timeCallback, interval=1000)
    
    
                