from file.file_service import FileService
from fastapi import APIRouter, HTTPException, UploadFile, File, Query, Response, Request
from fastapi.responses import StreamingResponse, JSONResponse
from typing import Optional, List, Dict
from datetime import datetime
import httpx

class FileRoutes:
    def __init__(self, fileService: FileService):
        self.fileService = fileService
        self.router = APIRouter(prefix="/api/files")
        self.setupRoutes()
        
    def setupRoutes(self):
        ## Extract Cookies Helper
        def extractCookies(req: Request) -> Dict[str, str]:
            cookies = {}
            for k, v in req.cookies.items():
                cookies[k] = v
            
            if cookies:
                print(f"[FileRoutes] Extracted cookies: {list(cookies.keys())}")
            else:
                print(f"[FileRoutes] WARNING: No cookies found in request!")
            
            return cookies
        
        ## Upload File
        @self.router.post("/upload/{userId}/{chatId}")
        async def uploadFile(
            userId: str,
            chatId: str,
            file: UploadFile = File(...),
            request: Request = None
        ):
            try:
                cookies = extractCookies(request) if request else {}
                
                if(file.filename == ''):
                    raise HTTPException(status_code=400, detail="No file selected")
                if(file.size > 1000 * 1024 * 1024):
                    raise HTTPException(status_code=400, detail="File too large (1GB)")
                
                tempPath = await self.fileService.saveFileTemp(file)
                res = await self.fileService.uploadFile(
                    filePath=tempPath,
                    userId=userId,
                    originalFileName=file.filename,
                    chatId=chatId,
                    cookies=cookies
                )
                return {
                    "success": True,
                    "message": "File uploaded",
                    "data": res
                }
            except Exception as err:
                raise HTTPException(status_code=500, detail=f"Upload failed: {str(err)}")
        
        @self.router.post("/upload-multiple/{userId}/{chatId}")
        async def uploadMultipleFiles(
            userId: str,
            chatId: str,
            files: List[UploadFile] = File(...),
            request: Request = None
        ):
            try:
                cookies = extractCookies(request) if request else {}
                res = []
                err = []
                
                for file in files:
                    try:
                        if(file.size > 1000 * 1024 * 1024):
                            err.append(f"{file.filename}: File too large")
                            continue
                        
                        tempPath = await self.fileService.saveFileTemp(file)
                        data = await self.fileService.uploadFile(
                            filePath=tempPath,
                            userId=userId,
                            originalFileName=file.filename,
                            chatId=chatId,
                            cookies=cookies
                        )
                        res.append({
                            "fileName": file.filename,
                            "sucess": True,
                            "data": data
                        })
                    except Exception as e:
                        err.append(f"{file.filename}: {str(e)}")
                    
                return {
                    "success": True if res else False,
                    "uploaded": len(res),
                    "failed": len(err),
                    "results": res,
                    "errors": err
                }
            except Exception as err:
                raise HTTPException(status_code=500, detail=f"Upload failed: {str(err)}")
            
        ## Download File
        @self.router.get("/download/{userId}/{fileId}")
        async def downloadFile(
            userId: str, 
            fileId: str,
            request: Request,
            response: Response
        ):
            try:
                cookies = extractCookies(request)
                return await self.fileService.downloadFile(
                    userId=userId,
                    fileId=fileId,
                    cookies=cookies
                )
            except Exception as err:
                print(f"Download error: {str(err)}")
                return JSONResponse(
                    content={"error": "Download failed", "details": str(err)},
                    status_code=500
                )
            
        ## File List
        @self.router.get("/list")
        async def listFiles(
            userId: str = Query(...),
            chatId: str = Query("root"),
            page: int = Query(0, ge=0),
            request: Request = None
        ):
            try:
                cookies = extractCookies(request) if request else {}
                res = await self.fileService.listFiles(
                    userId=userId,
                    chatId=chatId,
                    page=page,
                    cookies=cookies
                )
                return res
            except Exception as err:
                raise HTTPException(status_code=500, detail=f"Failed to list files: {str(err)}")
    
        ## Delete
        @self.router.delete("/delete/{userId}/{fileId}")
        async def deleteFile(userId: str, fileId: str, request: Request = None):
            try:
                cookies = extractCookies(request) if request else {}
                res = await self.fileService.deleteFile(userId, fileId, cookies=cookies)
                return {
                    "success": True,
                    "message": "File deleted successfully",
                    "data": res
                }
            except Exception as err:
                raise HTTPException(status_code=500, detail=f"Delete Failed: {str(err)}")
            
        ## Storage
        @self.router.get("/storage/{userId}")
        async def getStorageUsage(userId: str, request: Request = None):
            try:
                cookies = extractCookies(request) if request else {}
                usage = await self.fileService.getStorageUsage(userId, cookies=cookies)
                return {
                    "success": True,
                    "data": usage
                }
            except Exception as err:
                raise HTTPException(status_code=500, detail=f"Failed to get storage usage: {str(err)}")
        
        @self.router.get("/search")
        async def searchFiles(
            userId: str = Query(...),
            query: str = Query(...),
            fileType: Optional[str] = Query(None),
            page: int = Query(1, ge=1),
            request: Request = None
        ):
            try:
                cookies = extractCookies(request) if request else {}
                res = await self.fileService.searchFiles(
                    userId=userId,
                    query=query,
                    fileType=fileType,
                    page=page,
                    cookies=cookies
                )
                return {
                    "success": True,
                    "data": res
                }
            except Exception as err:
                raise HTTPException(status_code=500, detail=f"Search failed: {str(err)}")
            
        ## Count Files
        @self.router.get("/count")
        async def countFiles(
            userId: str = Query(...),
            chatId: str = Query("root"),
            request: Request = None
        ):
            try:
                cookies = extractCookies(request) if request else {}
                res = await self.fileService.countFiles(userId, chatId, cookies=cookies)
                return res
            except Exception as err:
                raise HTTPException(status_code=500, detail=f"Failed to count files: {str(err)}")
        
        ## Count Pages
        @self.router.get("/count-pages")
        async def countPages(
            userId: str = Query(...),
            chatId: str = Query("root"),
            request: Request = None
        ):
            try:
                cookies = extractCookies(request) if request else {}
                res = await self.fileService.countPages(userId, chatId, cookies=cookies)
                return res
            except Exception as err:
                raise HTTPException(status_code=500, detail=f"Failed to count pages: {str(err)}")
        
        ## Get Cache Key
        @self.router.get("/cache-key")
        async def getCacheKey(
            userId: str = Query(...),
            chatId: str = Query("root"),
            page: int = Query(0, ge=0),
            request: Request = None
        ):
            try:
                cookies = extractCookies(request) if request else {}
                res = await self.fileService.getCacheKey(userId, chatId, page, cookies=cookies)
                return res
            except Exception as err:
                raise HTTPException(status_code=500, detail=f"Failed to generate cache key: {str(err)}")
        
        ## Get Recent Files
        @self.router.get("/recent/{userId}")
        async def getRecentFiles(
            userId: str,
            page: int = Query(0),
            pageSize: int = Query(20),
            request: Request = None
        ):
            try:
                cookies = extractCookies(request) if request else {}
                result = await self.fileService.getRecentFiles(userId, page, pageSize, cookies=cookies)
                return {
                    "success": True,
                    "chats": result.get("files", []),
                    "total": len(result.get("files", [])),
                    "hasMore": len(result.get("files", [])) == pageSize
                }
            except Exception as e:
                raise HTTPException(status_code=500, detail=str(e))

        ## Get Recent Files Count
        @self.router.get("/recent/{userId}/count")
        async def getRecentFilesCount(userId: str, request: Request = None):
            try:
                cookies = extractCookies(request) if request else {}
                result = await self.fileService.getRecentFilesCount(userId, cookies=cookies)
                return {
                    "success": True,
                    "count": result.get("total", 0)
                }
            except Exception as e:
                raise HTTPException(status_code=500, detail=str(e))