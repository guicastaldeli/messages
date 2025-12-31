from fastapi import APIRouter, HTTPException, Request, Response, Cookie, Depends
from typing import Dict, Any, Optional
from auth.auth_service import AuthService
from user.user_service import UserService
import json

class AuthRoutes:
    def __init__(self, authService: AuthService, userService: UserService):
        self.authService = authService
        self.userService = userService
        self.router = APIRouter(prefix="/api/auth")
        self.setupRoutes()
        
    def setupRoutes(self):
        ## Extract Cookies
        def extractCookies(req: Request) -> Dict[str, str]:
            cookies = {}
            for k, v in req.cookies.items():
                cookies[k] = v
            return cookies
        
        ## Set Cookies
        def setCookies(res: Response, cookies: Dict[str, Any]):
            if(cookies):
                for k, v in cookies.items():
                    res.set_cookie(
                        key=k,
                        value=v,
                        httponly=k in ["SESSION_ID", "auth_token"],
                        secure=False,
                        samesite="lax",
                        max_age=7 * 24 * 60 * 60 if k == "SESSION_ID" else None
                    )
        
        ## Register
        @self.router.post("/register")
        async def registerUser(
            data: Dict[Any, Any],
            req: Request,
            res: Response
        ):
            try:
                
                emailCheck = await self.userService.getUserByEmail(data.get("email", ""))
                if(emailCheck.get("exists", False)):
                    raise HTTPException(
                        status_code=400, 
                        detail="User with this email already exists!"
                    )
                
                usernameCheck = await self.userService.getUserByUsername(data.get("username", ""))
                if(usernameCheck.get("exists", False)):
                    raise HTTPException(
                        status_code=400, 
                        detail="Username already taken!"
                    )
                
                result = await self.authService.registerUser(data)
                if("_cookies" in result):
                    setCookies(res, result["_cookies"])
                    del result["_cookies"]
                return result
            except HTTPException as err:
                raise err
            except Exception as err:
                raise HTTPException(
                    status_code=500,
                    detail=f"Registration failed: {str(err)}"
                )
        
        ## Login
        @self.router.post("/login")
        async def loginUser(
            data: Dict[Any, Any],
            req: Request,
            res: Response
        ):
            try:
                emailCheck = await self.userService.getUserByEmail(data.get("email", ""))
                if(not emailCheck.get("exists", False)):
                    raise HTTPException(
                        status_code=400, 
                        detail="Invalid email or password"
                    )
                
                result = await self.authService.loginUser(data)
                if("_cookies" in result):
                    setCookies(res, result["_cookies"])
                    del result["_cookies"]
                
                return result
            except HTTPException as err:
                raise err
            except Exception as err:
                raise HTTPException(
                    status_code=500,
                    detail=f"Login failed: {str(err)}"
                )
                
        ## Logout
        @self.router.post("/logout")
        async def logoutUser(req: Request, res: Response):
            try:
                cookies = extractCookies(req)
                result = await self.authService.logoutUser(cookies)
                for cookieName in ["SESSION_ID", "USER_INFO", "SESSION_STATUS", "auth_token"]:
                    res.delete_cookie(cookieName)
                return result
            except HTTPException as err:
                for cookieName in ["SESSION_ID", "USER_INFO", "SESSION_STATUS", "auth_token"]:
                    res.delete_cookie(cookieName)
                raise err
            except Exception as err:
                for cookieName in ["SESSION_ID", "USER_INFO", "SESSION_STATUS", "auth_token"]:
                    res.delete_cookie(cookieName)
                raise HTTPException(
                    status_code=500,
                    detail=f"Logout failed: {str(err)}"
                )
                
        ## Validate Session
        @self.router.get("/validate")
        async def validateSession(req: Request, res: Response):
            try:
                cookies = extractCookies(req)
                result = await self.authService.validateSession(cookies)
                
                if("_cookies" in result):
                    setCookies(res, result["_cookies"])
                    del result["_cookies"]
                    
                return {
                    "valid": result.get("valid", False),
                    "user": result.get("user"),
                    "authenticated": result.get("valid", False)
                }
                
            except HTTPException as err:
                for cookieName in ["SESSION_ID", "USER_INFO", "SESSION_STATUS", "auth_token"]:
                    res.delete_cookie(cookieName)
                return {
                    "valid": False,
                    "user": None,
                    "authenticated": False,
                    "error": str(err.detail) if hasattr(err, 'detail') else "Session invalid"
                }
                
            except Exception as err:
                for cookieName in ["SESSION_ID", "USER_INFO", "SESSION_STATUS", "auth_token"]:
                    res.delete_cookie(cookieName)
                return {
                    "valid": False,
                    "user": None,
                    "authenticated": False,
                    "error": f"Validation error: {str(err)}"
                }
                
        ## Refresh Token
        @self.router.post("/refresh")
        async def refreshSessionToken(req: Request, res: Response):
            try:
                cookies = extractCookies(req)
                result = await self.authService.refreshSessionToken(cookies)
                if("_cookies" in result):
                    setCookies(res, result["_cookies"])
                    del result["_cookies"]
                return result
            except HTTPException as err:
                if(err.status_code == 401):
                    for cookieName in ["SESSION_ID", "USER_INFO", "SESSION_STATUS", "auth_token"]:
                        res.delete_cookie(cookieName)
                raise err
            except Exception as err:
                raise HTTPException(
                    status_code=500,
                    detail=f"Refresh failed: {str(err)}"
                )
                
        ## Session Status
        @self.router.get("/status")
        async def sessionStatus(req: Request):
            try:
                cookies = extractCookies(req)
                result = await self.authService.getSessionStatus(cookies)
                return result
            except HTTPException as err:
                if(err.status_code in [401, 403]):
                    return { "authenticated": False }
            except Exception as err:
                return { "authenticated": False }
                
    
            