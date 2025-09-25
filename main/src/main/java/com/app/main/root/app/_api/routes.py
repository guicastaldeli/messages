from fastapi import APIRouter, Request
import os

router = APIRouter()

def resBaseUrl(req: Request, port: str | int) -> str:
    host = req.headers.get("host", "localhost")
    protocol = req.headers.get("x-forwarded-proto", "http")
    
    if(os.getenv("NODE_ENV") == "production"):
        return f"{protocol}://{host}"
    else:
        return f"http://localhost:{port}"
    
@router.get("/.api/routes")
async def getRoutes(req: Request):
    port = os.getenv("PORT", "3001")
    url = resBaseUrl(req, port)
    return { "url": url }