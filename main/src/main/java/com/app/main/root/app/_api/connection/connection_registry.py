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
                    "type": "mobile",
                    "ai_rules": [
                        "IF contains 'iphone' OR contains 'ipad' THEN device_brand='Apple' WITH confidence 0.95",
                        "IF contains 'mac' AND NOT contains 'phone' THEN device_type='desktop' WITH confidence 0.8"
                    ],
                    "common_os": ["iOS", "macOS"],
                    "impossible_combinations": ["Android", "Windows Phone"]
                },
                {
                    "brand": "Samsung", 
                    "models": ["Galaxy S", "Galaxy Note", "Galaxy Tab", "Galaxy A"],
                    "patterns": ["samsung", "sm-", "gt-", "galaxy"],
                    "type": "mobile",
                    "ai_rules": [
                        "IF contains 'samsung' AND contains 'mobile' THEN device_type='mobile' WITH confidence 0.9",
                        "IF contains 'sm-' THEN device_brand='Samsung' WITH confidence 0.95"
                    ],
                    "common_os": ["Android"],
                    "impossible_combinations": ["iOS"]
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
                    "engine": "Blink",
                    "ai_rules": [
                        "IF contains 'chrome' AND NOT contains 'edg' THEN browser='Chrome' WITH confidence 0.9",
                        "IF contains 'crios' THEN browser='Chrome' AND device_type='mobile' WITH confidence 0.8"
                    ],
                    "common_os": ["Windows", "macOS", "Linux", "Android", "iOS"],
                    "version_patterns": ["chrome/([0-9]+)", "crios/([0-9]+)"]
                },
                {
                    "name": "Safari",
                    "patterns": ["safari"],
                    "vendor": "Apple", 
                    "engine": "WebKit",
                    "ai_rules": [
                        "IF contains 'safari' AND NOT contains 'chrome' THEN browser='Safari' WITH confidence 0.8",
                        "IF browser='Safari' AND os='Android' THEN IMPOSSIBLE WITH confidence 0.99"
                    ],
                    "common_os": ["iOS", "macOS"],
                    "version_patterns": ["version/([0-9]+)"]
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
                        "11": {"pattern": "windows nt 10.0", "confidence": 0.9},
                        "10": {"pattern": "windows nt 10.0", "confidence": 0.9}, 
                        "8.1": {"pattern": "windows nt 6.3", "confidence": 0.8}
                    },
                    "ai_rules": [
                        "IF contains 'windows nt' THEN os='Windows' WITH confidence 0.9",
                        "IF os='Windows' AND device_type='mobile' THEN UNUSUAL WITH confidence 0.7"
                    ],
                    "common_browsers": ["Chrome", "Firefox", "Edge"],
                    "unusual_browsers": ["Safari"]
                },
                {
                    "name": "iOS",
                    "patterns": ["iphone", "ipad"],
                    "versions": {
                        "26": {"pattern": "os 26", "confidence": 0.9},
                        "18": {"pattern": "os 18", "confidence": 0.9},
                        "17": {"pattern": "os 17", "confidence": 0.9},
                        "16": {"pattern": "os 16", "confidence": 0.9},
                        "15": {"pattern": "os 15", "confidence": 0.9}
                    },
                    "ai_rules": [
                        "IF contains 'iphone' OR contains 'ipad' THEN os='iOS' WITH confidence 0.95",
                        "IF os='iOS' AND browser='Firefox' THEN browser='Safari' WITH confidence 0.8"
                    ],
                    "common_browsers": ["Safari", "Chrome"],
                    "unusual_browsers": ["Firefox"]
                }
            ]
            
    ## Rules
    def rules(self):
        @self.router.post("/registry/rules")
        async def exec(ex: Dict):
            return [
                {
                    "category": "impossible_combinations",
                    "rules": [
                        "IF browser='Safari' AND os='Android' THEN IMPOSSIBLE",
                        "IF device_brand='Apple' AND os='Android' THEN IMPOSSIBLE",
                        "IF device_type='tv' AND os='Windows' THEN UNUSUAL"
                    ]
                },
                {
                    "category": "common_patterns", 
                    "rules": [
                        "IF os='iOS' THEN device_brand='Apple' WITH confidence 0.95",
                        "IF os='Android' THEN device_type='mobile' WITH confidence 0.8",
                        "IF contains 'mobile' THEN device_type='mobile' WITH confidence 0.7"
                    ]
                }
            ]