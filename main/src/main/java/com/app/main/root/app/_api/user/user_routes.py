from fastapi import APIRouter, HTTPException
from typing import List, Dict, Any
from user.user_service import UserService

class UserRoutes:
    def __init__(self, userService: UserService):
        self.router = APIRouter()
        self.userService = userService
        self.setupRoutes()
        
    def setupRoutes(self):
        ##
        ## All
        ##
        @self.router.get("/api/users/all")
        async def getAllUsers():
            return await self.userService.getAllUsers()
        
        ##
        ## Online
        ##
        @self.router.get("/api/users/online")
        async def getOnlineUsers():
            return await self.userService.getOnlineUsers()
        
        ##
        ## Check Email
        ##
        @self.router.get("/api/users/email/{email}")
        async def checkUserByEmail(email: str):
            try:
                return await self.userService.getUserByEmail(email)
            except HTTPException:
                return { "exists": False, "user": None }
            
        ##
        ## Check Username
        ##
        @self.router.get("/api/users/username/{username}")
        async def checkUserByUsername(username: str):
            try:
                return await self.userService.getUserByUsername(username)
            except HTTPException:
                return { "exists": False, "user": None }
            
        ##
        ## Register**
        ##
        @self.router.post("/api/auth/register")
        async def registerUser(data: Dict[Any, Any]):
            emailCheck = await self.userService.getUserByEmail(data.get("email", ""))
            if(emailCheck.get("exists", False)):
                raise HTTPException(status_code=400, detail="User with this email already exists!")
            
            usernameCheck = await self.userService.getUserByUsername(data.get("username", ""))
            if(usernameCheck.get("exists", False)):
                raise HTTPException(status_code=400, detail="Username already taken!")
            
            return await self.userService.registerUser(data)
        
        ##
        ## Login**
        ##
        @self.router.post("/api/auth/login")
        async def loginUser(data: Dict[Any, Any]):
            emailCheck = await self.userService.getUserByEmail(data.get("email", ""))
            if(not emailCheck.get("exists", False)):
                raise HTTPException(status_code=400, detail="User not found")
            
            return await self.userService.loginUser(data)