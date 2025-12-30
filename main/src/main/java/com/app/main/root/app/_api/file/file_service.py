from fastapi import HTTPException, UploadFile, Response
from typing import Dict, Any, Optional, List
from fastapi.responses import StreamingResponse
import httpx
import json
import uuid
from datetime import datetime
import aiofiles
import os
import shutil
from pathlib import Path


class FileService:
    def __init__(self, url: str):
        self.url = url
        self.url = url.rstrip('/')
        
    ## Save File Temp
    async def saveFileTemp(self, file: UploadFile) -> str:
        try:
            fileId = str(uuid.uuid4())
            fileExt = os.path.splitext(file.filename)[1] if '.' in file.filename else ''
            tempFileName = f"{fileId}{fileExt}"
            tempPath = tempFileName
            
            async with aiofiles.open(tempPath, 'wb') as outFile:
                content = await file.read()
                await outFile.write(content)
            
            return str(tempPath)
        except Exception as err:
            raise HTTPException(status_code=500, detail=f"Failed to save file: {(err)}")
        
    ## Upload File
    async def uploadFile(
        self,
        filePath: str,
        userId: str,
        originalFileName: str,
        parentFolderId: str = "root"
    ) -> Dict[str, Any]:
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                async with aiofiles.open(filePath, 'rb') as f:
                    fileContent = await f.read()
                    
                files = {
                    'file': (originalFileName, fileContent)
                }
                
                res = await client.post(
                    f"{self.url}/api/files/upload/{userId}/{parentFolderId}",
                    files=files
                )
                if(os.path.exists(filePath)):
                    os.remove(filePath)
                if(res.status_code == 200):
                    return res.json()
                else:
                    errorDetail = res.text
                    try:
                        errorJson = res.json()
                        errDetail = errorJson.get('error', errorJson.get('message', errDetail))
                    except:
                        pass
                    raise HTTPException(
                        status_code=res.status_code,
                        detail=f"Server error: {errDetail}"
                    )
        except httpx.RequestError as err:
            raise HTTPException(
                status_code=503,
                detail=f"Service unavailable: {str(err)}"
            )
        except Exception as err:
            if(os.path.exists(filePath)):
                os.remove(filePath)
            raise HTTPException(status_code=500, detail=str(err))
        
    ## Download File
    async def downloadFile(self, userId: str, fileId: str):
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                url = f"{self.url}/api/files/download/{userId}/{fileId}"
                print(f"Forwarding download request to: {url}")
                
                async with client.stream('GET', url) as response:
                    if response.status_code != 200:
                        error_text = await response.aread()
                        raise HTTPException(
                            status_code=response.status_code,
                            detail=f"Backend error: {error_text.decode() if error_text else 'Unknown error'}"
                        )
                    headers = dict(response.headers)
                    
                    return StreamingResponse(
                        response.aiter_bytes(),
                        media_type=headers.get('content-type', 'application/octet-stream'),
                        headers={
                            'Content-Disposition': headers.get(
                                'content-disposition', 
                                f'attachment; filename="{fileId}"'
                            ),
                            'Content-Length': headers.get('content-length', ''),
                            'Access-Control-Expose-Headers': 'Content-Disposition, Content-Length'
                        }
                    ) 
        except httpx.RequestError as err:
            print(f"HTTP request error: {str(err)}")
            raise HTTPException(status_code=503, detail=f"Service unavailable: {str(err)}")
        except Exception as err:
            print(f"Download error: {str(err)}")
            raise HTTPException(status_code=500, detail=f"Download failed: {str(err)}")
        
    ## List Files
    async def listFiles(
        self,
        userId: str,
        parentFolderId: str = "root",
        page: int = 0
    ) -> Dict[str, Any]:
        try:
            async with httpx.AsyncClient() as client:
                params = {
                    'userId': userId,
                    'parentFolderId': parentFolderId,
                    'page': page,
                    'pageSize': 5
                }
                
                res = await client.get(f"{self.url}/api/files/list", params=params)
                if(res.status_code == 200):
                    return res.json()
                else:
                    raise HTTPException(
                        status_code=res.status_code,
                        detail=res.text
                    )
        except httpx.RequestError as err:
            raise HTTPException(status_code=503, detail=f"Service unavailable: {str(err)}")
        
    ## Delete File
    async def deleteFile(self, userId: str, fileId: str) -> Dict[str, Any]:
        try:
            async with httpx.AsyncClient() as client:
                res = await client.delete(f"{self.url}/api/files/delete/{userId}/{fileId}")
                if(res.status_code == 200):
                    return res.json()
                else:
                    raise HTTPException(
                        status_code=res.status_code,
                        detail=res.text
                    )
        except httpx.RequestError as err:
            raise HTTPException(status_code=503, detail=f"Service unavailable: {str(err)}")
            
    ## Get Storage Usage
    async def getStorageUsage(self, userId: str) -> Dict[str, Any]:
        try:
            async with httpx.AsyncClient() as client:
                res = await client.get(
                    f"{self.url}/api/files/storage/{userId}"
                )
                if(res.status_code == 200):
                    return res.json()
                else:
                    raise HTTPException(
                        status_code=res.status_code,
                        detail=res.text
                    )
        except httpx.RequestError as err:
            raise HTTPException(status_code=503, detail=f"Service unavailable")
        
    ## Search Files
    async def searchFiles(
        self,
        userId: str,
        query: str,
        fileType: Optional[str] = None,
        page: int = 0
    ) -> Dict[str, Any]:
        try:
            async with httpx.AsyncClient() as client:
                params = {
                    'userId': userId,
                    'query': query,
                    'fileType': fileType,
                    'page': page,
                    'pageSize': 5
                }
                params = {
                    k: v for k, v in params.items()
                    if v is not None
                }
                
                res = await client.get(
                    f"{self.url}/api/files/search",
                    params=params
                )
                if(res.status_code == 200):
                    return res.json()
                else:
                    raise HTTPException(
                        status_code=res.status_code,
                        detail=res.text
                    )
        except httpx.RequestError as err:
            raise HTTPException(status_code=503, detail=f"Service unavailable: {str(err)}")
        
    ## Count Files
    async def countFiles(self, userId: str, folderId: str = "root") -> Dict[str, Any]:
        try:
            async with httpx.AsyncClient() as client:
                params = {
                    'userId': userId,
                    'folderId': folderId
                }
                
                res = await client.get(f"{self.url}/api/files/count", params=params)
                if(res.status_code == 200):
                    return res.json()
                else:
                    raise HTTPException(
                        status_code=res.status_code,
                        detail=res.text
                    )
        except httpx.RequestError as err:
            raise HTTPException(status_code=503, detail=f"Service unavailable: {str(err)}")
        
    ## Count Pages
    async def countPages(
        self, 
        userId: str, 
        folderId: str = "root"
    ) -> Dict[str, Any]:
        try:
            async with httpx.AsyncClient() as client:
                params = {
                    'userId': userId,
                    'folderId': folderId,
                    'pageSize': 5
                }
                
                res = await client.get(f"{self.url}/api/files/count-pages", params=params)
                if(res.status_code == 200):
                    return res.json()
                else:
                    raise HTTPException(
                        status_code=res.status_code,
                        detail=res.text
                    )
        except httpx.RequestError as err:
            raise HTTPException(status_code=503, detail=f"Service unavailable: {str(err)}")
        
    ## Get Cache Key
    async def getCacheKey(
        self, 
        userId: str, 
        folderId: str = "root", 
        page: int = 0
    ) -> Dict[str, Any]:
        try:
            async with httpx.AsyncClient() as client:
                params = {
                    'userId': userId,
                    'folderId': folderId,
                    'page': page
                }
                
                res = await client.get(f"{self.url}/api/files/cache-key", params=params)
                if(res.status_code == 200):
                    return res.json()
                else:
                    raise HTTPException(
                        status_code=res.status_code,
                        detail=res.text
                    )
        except httpx.RequestError as err:
            raise HTTPException(status_code=503, detail=f"Service unavailable: {str(err)}")