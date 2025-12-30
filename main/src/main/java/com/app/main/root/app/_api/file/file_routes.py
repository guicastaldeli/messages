from file.file_service import FileService
from fastapi import APIRouter, HTTPException, UploadFile, File, Query, Response, Request
from fastapi.responses import StreamingResponse, JSONResponse
from typing import Optional, List
from datetime import datetime
import httpx

class FileRoutes:
    def __init__(self, fileService: FileService):
        self.fileService = fileService
        self.router = APIRouter(prefix="/api/files")
        self.setupRoutes()
        
    def setupRoutes(self):
        ## Upload File
        @self.router.post("/upload/{userId}/{chatId}")
        async def uploadFile(
            userId: str,
            chatId: str = "root",
            file: UploadFile = File(...)
        ):
            try:
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
            chatId: str = "root",
            files: List[UploadFile] = File(...)
        ):
            try:
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
                            chatId=chatId
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
                async with httpx.AsyncClient(timeout=30.0) as client:
                    url = f"{self.fileService.url}/api/files/download/{userId}/{fileId}"
                    headers = {}
                    if ("cookie" in request.headers):
                        headers["cookie"] = request.headers["cookie"]
                    
                    serverRes = await client.get(url, headers=headers, follow_redirects=True)
                    
                    if serverRes.status_code != 200:
                        return JSONResponse(
                            content={"error": "Download failed", "details": serverRes.text},
                            status_code=serverRes.status_code
                        )
                    
                    content_type = serverRes.headers.get("content-type", "application/octet-stream")
                    content_disposition = serverRes.headers.get(
                        "content-disposition", 
                        f'attachment; filename="{fileId}"'
                    )
                    
                    response.headers["Content-Type"] = content_type
                    response.headers["Content-Disposition"] = content_disposition
                    response.headers["Content-Length"] = serverRes.headers.get("content-length", "")
                    response.headers["Access-Control-Expose-Headers"] = "Content-Disposition, Content-Length"
                    return Response(
                        content=serverRes.content,
                        media_type=content_type,
                        headers={
                            "Content-Disposition": content_disposition,
                            "Content-Length": serverRes.headers.get("content-length", ""),
                            "Access-Control-Expose-Headers": "Content-Disposition, Content-Length"
                        }
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
            page: int = Query(0, ge=0)
        ):
            try:
                res = await self.fileService.listFiles(
                    userId=userId,
                    chatId=chatId,
                    page=page
                )
                return res
            except Exception as err:
                raise HTTPException(status_code=500, detail=f"Failed to list files: {str(err)}")
    
        ## Delete
        @self.router.delete("/delete/{userId}/{fileId}")
        async def deleteFile(userId: str, fileId: str):
            try:
                res = await self.fileService.deleteFile(userId, fileId)
                return {
                    "success": True,
                    "message": "File deleted successfully",
                    "data": res
                }
            except Exception as err:
                raise HTTPException(status_code=500, detail=f"Delete Failed: {str(err)}")
            
        ## Storage
        @self.router.get("/storage/{userId}")
        async def getStorageUsage(userId: str):
            try:
                usage = await self.fileService.getStorageUsage(userId)
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
            page: int = Query(1, ge=1)
        ):
            try:
                res = await self.fileService.searchFiles(
                    userId=userId,
                    query=query,
                    fileType=fileType,
                    page=page
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
            chatId: str = Query("root")
        ):
            try:
                res = await self.fileService.countFiles(userId, chatId)
                return res
            except Exception as err:
                raise HTTPException(status_code=500, detail=f"Failed to count files: {str(err)}")
        
        ## Count Pages
        @self.router.get("/count-pages")
        async def countPages(
            userId: str = Query(...),
            chatId: str = Query("root")
        ):
            try:
                res = await self.fileService.countPages(userId, chatId)
                return res
            except Exception as err:
                raise HTTPException(status_code=500, detail=f"Failed to count pages: {str(err)}")
        
        ## Get Cache Key
        @self.router.get("/cache-key")
        async def getCacheKey(
            userId: str = Query(...),
            chatId: str = Query("root"),
            page: int = Query(0, ge=0)
        ):
            try:
                res = await self.fileService.getCacheKey(userId, chatId, page)
                return res
            except Exception as err:
                raise HTTPException(status_code=500, detail=f"Failed to generate cache key: {str(err)}")