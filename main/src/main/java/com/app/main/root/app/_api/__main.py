from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import httpx
import os

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3001", "http://localhost:3000"],
    allow_methods=["*"],
    allow_headers=["*"]
)
DB_API_URL = os.getenv(
    'DB_API_URL',
    'http://localhost:3001'
)

class DbService:
    def __init__(self, url: str):
        self.base_url = url
    
    ##
    ## Messages by chat id
    ##
    async def getMessagesByChatId(self, chatId: str) -> list:
        async with httpx.AsyncClient() as client:
            res = await client.get(f"{self.base_url}/api/messages", params={"chatId": chatId})
            if(res.status_code != 200):
                raise HTTPException(status_code=res.status_code, detail=res.json())
            return res.json()
        
    ##
    ## Recent Chats
    ##
    async def getRecentChats(self, userId: str = "") -> list:
        async with httpx.AsyncClient() as client:
            res = await client.get(f"${self.base_url}/api/recent-chats", params={"userId": userId})
            if(res.status_code != 200):
                raise HTTPException(status_code=res.status_code, detail=res.json())
            return res.json()
    
    ##
    ## User by id
    ##
    async def getUserById(self, userId: str) -> dict:
        async with httpx.AsyncClient() as client:
            res = await client.get(f"{self.base_url}/api/users/{userId}")
            if(res.status_code != 200):
                raise HTTPException(status_code=res.status_code, detail=res.json())
            return res.json()
        
dbService = DbService(DB_API_URL)
        
    
                