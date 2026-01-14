from fastapi import HTTPException, UploadFile
from typing import Dict, Any, Optional
from fastapi.responses import StreamingResponse
import httpx
import uuid
import os
import aiofiles


class FileService:
    def __init__(self, url: str):
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
            raise HTTPException(status_code=500, detail=f"Failed to save file: {str(err)}")
        
    ## Upload File
    async def uploadFile(
        self,
        filePath: str,
        userId: str,
        originalFileName: str,
        chatId: str,
        cookies: Optional[Dict[str, str]] = None
    ) -> Dict[str, Any]:
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                async with aiofiles.open(filePath, 'rb') as f:
                    fileContent = await f.read()
                    
                files = {
                    'file': (originalFileName, fileContent)
                }
                
                # Log cookies
                if cookies:
                    print(f"[FileService] Uploading with cookies: {list(cookies.keys())}")
                
                res = await client.post(
                    f"{self.url}/api/files/upload/{userId}/{chatId}",
                    files=files,
                    cookies=cookies,  # Forward cookies
                    follow_redirects=True
                )
                
                if os.path.exists(filePath):
                    os.remove(filePath)
                    
                if res.status_code == 200:
                    return res.json()
                else:
                    errorDetail = res.text
                    try:
                        errorJson = res.json()
                        errorDetail = errorJson.get('error', errorJson.get('message', errorDetail))
                    except:
                        pass
                    raise HTTPException(
                        status_code=res.status_code,
                        detail=f"Server error: {errorDetail}"
                    )
        except httpx.RequestError as err:
            if os.path.exists(filePath):
                os.remove(filePath)
            raise HTTPException(
                status_code=503,
                detail=f"Service unavailable: {str(err)}"
            )
        except Exception as err:
            if os.path.exists(filePath):
                os.remove(filePath)
            raise HTTPException(status_code=500, detail=str(err))
        
    ## Download File
    async def downloadFile(
        self, 
        userId: str, 
        fileId: str,
        cookies: Optional[Dict[str, str]] = None
    ):
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                url = f"{self.url}/api/files/download/{userId}/{fileId}"
                print(f"[FileService] Downloading from: {url}")
                
                if cookies:
                    print(f"[FileService] Download with cookies: {list(cookies.keys())}")
                
                async with client.stream(
                    'GET', 
                    url,
                    cookies=cookies,  # Forward cookies
                    follow_redirects=True
                ) as response:
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
            print(f"[FileService] HTTP request error: {str(err)}")
            raise HTTPException(status_code=503, detail=f"Service unavailable: {str(err)}")
        except Exception as err:
            print(f"[FileService] Download error: {str(err)}")
            raise HTTPException(status_code=500, detail=f"Download failed: {str(err)}")
        
    ## List Files
    async def listFiles(
        self,
        userId: str,
        chatId: str,
        page: int = 0,
        cookies: Optional[Dict[str, str]] = None
    ) -> Dict[str, Any]:
        try:
            async with httpx.AsyncClient() as client:
                params = {
                    'userId': userId,
                    'chatId': chatId,
                    'page': page,
                    'pageSize': 5
                }
                
                if cookies:
                    print(f"[FileService] Listing files with cookies: {list(cookies.keys())}")
                
                res = await client.get(
                    f"{self.url}/api/files/list",
                    params=params,
                    cookies=cookies,  # Forward cookies
                    follow_redirects=True
                )
                
                if res.status_code == 200:
                    return res.json()
                else:
                    raise HTTPException(
                        status_code=res.status_code,
                        detail=res.text
                    )
        except httpx.RequestError as err:
            raise HTTPException(status_code=503, detail=f"Service unavailable: {str(err)}")
        
    ## Delete File
    async def deleteFile(
        self, 
        userId: str, 
        fileId: str,
        cookies: Optional[Dict[str, str]] = None
    ) -> Dict[str, Any]:
        try:
            async with httpx.AsyncClient() as client:
                res = await client.delete(
                    f"{self.url}/api/files/delete/{userId}/{fileId}",
                    cookies=cookies,  # Forward cookies
                    follow_redirects=True
                )
                
                if res.status_code == 200:
                    return res.json()
                else:
                    raise HTTPException(
                        status_code=res.status_code,
                        detail=res.text
                    )
        except httpx.RequestError as err:
            raise HTTPException(status_code=503, detail=f"Service unavailable: {str(err)}")
            
    ## Get Storage Usage
    async def getStorageUsage(
        self, 
        userId: str,
        cookies: Optional[Dict[str, str]] = None
    ) -> Dict[str, Any]:
        try:
            async with httpx.AsyncClient() as client:
                res = await client.get(
                    f"{self.url}/api/files/storage/{userId}",
                    cookies=cookies,  # Forward cookies
                    follow_redirects=True
                )
                
                if res.status_code == 200:
                    return res.json()
                else:
                    raise HTTPException(
                        status_code=res.status_code,
                        detail=res.text
                    )
        except httpx.RequestError as err:
            raise HTTPException(status_code=503, detail="Service unavailable")
        
    ## Count Files
    async def countFiles(
        self, 
        userId: str, 
        chatId: str,
        cookies: Optional[Dict[str, str]] = None
    ) -> Dict[str, Any]:
        try:
            async with httpx.AsyncClient() as client:
                params = {
                    'userId': userId,
                    'chatId': chatId
                }
                
                res = await client.get(
                    f"{self.url}/api/files/count",
                    params=params,
                    cookies=cookies,  # Forward cookies
                    follow_redirects=True
                )
                
                if res.status_code == 200:
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
        chatId: str,
        cookies: Optional[Dict[str, str]] = None
    ) -> Dict[str, Any]:
        try:
            async with httpx.AsyncClient() as client:
                params = {
                    'userId': userId,
                    'chatId': chatId,
                    'pageSize': 5
                }
                
                res = await client.get(
                    f"{self.url}/api/files/count-pages",
                    params=params,
                    cookies=cookies,  # Forward cookies
                    follow_redirects=True
                )
                
                if res.status_code == 200:
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
        chatId: str, 
        page: int = 0,
        cookies: Optional[Dict[str, str]] = None
    ) -> Dict[str, Any]:
        try:
            async with httpx.AsyncClient() as client:
                params = {
                    'userId': userId,
                    'chatId': chatId,
                    'page': page
                }
                
                res = await client.get(
                    f"{self.url}/api/files/cache-key",
                    params=params,
                    cookies=cookies,  # Forward cookies
                    follow_redirects=True
                )
                
                if res.status_code == 200:
                    return res.json()
                else:
                    raise HTTPException(
                        status_code=res.status_code,
                        detail=res.text
                    )
        except httpx.RequestError as err:
            raise HTTPException(status_code=503, detail=f"Service unavailable: {str(err)}")
        
    ## Get Recent Files - FIXED
    async def getRecentFiles(
        self,
        userId: str,
        page: int = 0,
        pageSize: int = 20,
        cookies: Optional[Dict[str, str]] = None
    ) -> Dict[str, Any]:
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                params = {
                    'page': page,
                    'pageSize': pageSize
                }
                
                if cookies:
                    print(f"[FileService] Getting recent files with cookies: {list(cookies.keys())}")
                else:
                    print(f"[FileService] WARNING: No cookies for recent files")
                
                res = await client.get(
                    f"{self.url}/api/files/recent/{userId}",
                    params=params,
                    cookies=cookies,  # Forward cookies
                    follow_redirects=True
                )
                
                if res.status_code == 200:
                    return res.json()
                else:
                    print(f"[FileService] Recent files failed: {res.status_code} - {res.text}")
                    # Return empty result instead of failing
                    return {
                        'files': [],
                        'total': 0,
                        'hasMore': False
                    }
        except httpx.RequestError as err:
            print(f"[FileService] Request error: {str(err)}")
            return {
                'files': [],
                'total': 0,
                'hasMore': False
            }
        except Exception as err:
            print(f"[FileService] Error: {str(err)}")
            return {
                'files': [],
                'total': 0,
                'hasMore': False
            }

    ## Get Recent Files Count
    async def getRecentFilesCount(
        self, 
        userId: str,
        cookies: Optional[Dict[str, str]] = None
    ) -> Dict[str, Any]:
        try:
            async with httpx.AsyncClient() as client:
                res = await client.get(
                    f"{self.url}/api/files/recent/{userId}/count",
                    cookies=cookies,  # Forward cookies
                    follow_redirects=True
                )
                
                if res.status_code == 200:
                    return res.json()
                else:
                    return {'total': 0}
        except httpx.RequestError as err:
            print(f"[FileService] Error getting recent files count: {str(err)}")
            return {'total': 0}