from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from messages.message_service import MessageService
from messages.message_routes import MessageRoutes
from __endpoints import router as router
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
        
        self.messageService = MessageService(DB_API_URL)
        self.messageRoutes = MessageRoutes(self.messageService)
        
        self.app.include_router(router)
        self.app.include_router(self.messageRoutes.router)

#Init
instance = Main()
app = instance.app
messageService = instance.messageService
    
    
                