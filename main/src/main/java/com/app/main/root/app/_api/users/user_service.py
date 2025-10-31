from fastapi import HTTPException
import httpx

class UserService:
    def __init__(self, url: str):
        self.base_url = url