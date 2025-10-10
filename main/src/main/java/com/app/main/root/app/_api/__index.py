from fastapi import APIRouter
from fastapi.responses import HTMLResponse
import os

router = APIRouter()
locDir = os.path.dirname(os.path.abspath(__file__))
htmlFilePath = os.path.join(locDir, '___index.html')

@router.get("/", response_class=HTMLResponse)
async def root():
    with open(htmlFilePath, 'r', encoding='utf-8') as file:
        content = file.read()
    return content

