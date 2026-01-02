from fastapi import APIRouter, HTTPException
from typing import List, Dict, Any
from user.user_service import UserService

class UserRoutes:
    def __init__(self, userService: UserService):
        self.router = APIRouter()
        self.userService = userService
        self.setupRoutes()
        
    def setupRoutes(self):
        ## All
        @self.router.get("/api/users/all")
        async def getAllUsers():
            return await self.userService.getAllUsers()
        
        ## Online
        @self.router.get("/api/users/online")
        async def getOnlineUsers():
            return await self.userService.getOnlineUsers()
        
        ## Check Email
        @self.router.get("/api/users/email/{email}")
        async def checkUserByEmail(email: str):
            try:
                return await self.userService.getUserByEmail(email)
            except HTTPException:
                return { "exists": False, "user": None }
            
        ## Check Username
        @self.router.get("/api/users/username/{username}")
        async def checkUserByUsername(username: str):
            try:
                return await self.userService.getUserByUsername(username)
            except HTTPException:
                return { "exists": False, "user": None }