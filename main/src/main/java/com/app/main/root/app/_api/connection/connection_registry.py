from connection.connection_service import ConnectionService
from typing import Dict, List
from fastapi import APIRouter

class ConnectionRegistry:
    def __init__(
        self, 
        router: APIRouter, 
        connectionService: ConnectionService
    ):
        self.router = router
        self.connectionService = connectionService
        
        self.devices()
        self.browsers()
        self.os()
        self.train()
        
    ## Devices
    def devices(self):
        @self.router.get("/registry/devices")
        async def list() -> List[Dict]:
            return [
                {
                    "brand": "Apple",
                    "models": ["iPhone", "iPad", "Mac", "iPod"],
                    "patterns": ["iphone", "ipad", "mac", "ipod"],
                    "type": "mobile"
                },
                {
                    "brand": "Samsung", 
                    "models": ["Galaxy S", "Galaxy Note", "Galaxy Tab", "Galaxy A"],
                    "patterns": ["samsung", "sm-", "gt-", "galaxy"],
                    "type": "mobile"
                },
                {
                    "brand": "Google",
                    "models": ["Pixel", "Nexus", "Chromebook"],
                    "patterns": ["pixel", "nexus", "chromebook"],
                    "type": "mobile"
                },
                {
                    "brand": "Huawei",
                    "models": ["P series", "Mate series", "Honor"],
                    "patterns": ["huawei", "honor"],
                    "type": "mobile"
                },
                {
                    "brand": "Xiaomi",
                    "models": ["Mi series", "Redmi", "Poco"],
                    "patterns": ["xiaomi", "redmi", "poco"],
                    "type": "mobile"
                },
                {
                    "brand": "Desktop",
                    "models": ["Windows PC", "Mac Desktop", "Linux PC"],
                    "patterns": ["windows", "macintosh", "linux", "x11"],
                    "type": "desktop"
                },
                {
                    "brand": "Tablet",
                    "models": ["iPad", "Android Tablet", "Windows Tablet"],
                    "patterns": ["tablet", "ipad", "tab"],
                    "type": "tablet"
                },
                {
                    "brand": "Bot",
                    "models": ["Googlebot", "Bingbot", "Slurp", "DuckDuckBot"],
                    "patterns": ["bot", "crawler", "spider", "slurp"],
                    "type": "bot"
                }
            ]
            
    ## Browsers
    def browsers(self):
        @self.router.get("/registry/browsers")
        async def list() -> List[Dict]:
            return [
                {
                    "name": "Chrome",
                    "patterns": ["chrome", "crios"],
                    "vendor": "Google",
                    "engine": "Blink"
                },
                {
                    "name": "Firefox", 
                    "patterns": ["firefox", "fxios"],
                    "vendor": "Mozilla",
                    "engine": "Gecko"
                },
                {
                    "name": "Safari",
                    "patterns": ["safari"],
                    "vendor": "Apple", 
                    "engine": "WebKit"
                },
                {
                    "name": "Edge",
                    "patterns": ["edg", "edge"],
                    "vendor": "Microsoft",
                    "engine": "Blink"
                },
                {
                    "name": "Opera",
                    "patterns": ["opera", "opr/"],
                    "vendor": "Opera",
                    "engine": "Blink"
                },
                {
                    "name": "Brave",
                    "patterns": ["brave"],
                    "vendor": "Brave Software",
                    "engine": "Blink"
                },
                {
                    "name": "Samsung Internet",
                    "patterns": ["samsungbrowser"],
                    "vendor": "Samsung",
                    "engine": "WebKit"
                },
                {
                    "name": "UC Browser",
                    "patterns": ["ucbrowser"],
                    "vendor": "UCWeb",
                    "engine": "WebKit"
                }
            ]
            
    ## OS
    def os(self):
        @self.router.get("/registry/os")
        async def list() -> List[Dict]:
            return [
                {
                    "name": "Windows",
                    "patterns": ["windows"],
                    "versions": {
                        "11": "windows nt 10.0",
                        "10": "windows nt 10.0", 
                        "8.1": "windows nt 6.3",
                        "8": "windows nt 6.2",
                        "7": "windows nt 6.1",
                        "Vista": "windows nt 6.0",
                        "XP": "windows nt 5.1"
                    }
                },
                {
                    "name": "macOS",
                    "patterns": ["mac os", "macos"],
                    "versions": {
                        "Ventura": "mac os x 13",
                        "Monterey": "mac os x 12", 
                        "Big Sur": "mac os x 11",
                        "Catalina": "mac os x 10.15",
                        "Mojave": "mac os x 10.14",
                        "High Sierra": "mac os x 10.13"
                    }
                },
                {
                    "name": "Linux",
                    "patterns": ["linux", "ubuntu", "fedora", "debian"],
                    "versions": {}
                },
                {
                    "name": "Android", 
                    "patterns": ["android"],
                    "versions": {
                        "16": "android 16",
                        "15": "android 15",
                        "14": "android 14",
                        "13": "android 13",
                        "12": "android 12",
                        "11": "android 11", 
                        "10": "android 10",
                        "9": "android 9",
                        "8": "android 8"
                    }
                },
                {
                    "name": "iOS",
                    "patterns": ["iphone", "ipad"],
                    "versions": {
                        "26": "os 26",
                        "18": "os 18",
                        "17": "os 17",
                        "16": "os 16",
                        "15": "os 15",
                        "14": "os 14",
                        "13": "os 13",
                        "12": "os 12"
                    }
                },
                {
                    "name": "Chrome OS",
                    "patterns": ["cros"],
                    "versions": {}
                }
            ]
            
    ## Train
    def train(self):
        @self.router.post("/registry/train")
        async def exec(ex: Dict):
            userAgent = ex.get("userAgent")
            browser = ex.get("browser")
            os = ex.get("os")
            device = ex.get("device")
            
            print(f"Ex: {userAgent}, {browser}, {os}, {device}")
            return { "status": "training_ex_added" }