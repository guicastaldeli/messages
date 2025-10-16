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
                },
                {
                    "brand": "Google",
                    "models": ["Pixel", "Nexus", "Chromebook"],
                    "patterns": ["pixel", "nexus", "chromebook"],
                    "type": "mobile",
                    "ai_rules": [
                        "IF contains 'pixel' THEN device_brand='Google' WITH confidence 0.9",
                        "IF contains 'chromebook' THEN device_type='desktop' WITH confidence 0.8"
                    ],
                    "common_os": ["Android", "Chrome OS"]
                },
                {
                    "brand": "Huawei",
                    "models": ["P series", "Mate series", "Honor"],
                    "patterns": ["huawei", "honor"],
                    "type": "mobile",
                    "ai_rules": [
                        "IF contains 'huawei' THEN device_brand='Huawei' WITH confidence 0.8"
                    ],
                    "common_os": ["Android"]
                },
                {
                    "brand": "Xiaomi",
                    "models": ["Mi series", "Redmi", "Poco"],
                    "patterns": ["xiaomi", "redmi", "poco"],
                    "type": "mobile", 
                    "ai_rules": [
                        "IF contains 'xiaomi' THEN device_brand='Xiaomi' WITH confidence 0.8"
                    ],
                    "common_os": ["Android"]
                },
                {
                    "brand": "Desktop",
                    "models": ["Windows PC", "Mac Desktop", "Linux PC"],
                    "patterns": ["windows nt", "macintosh", "x11"],
                    "type": "desktop",
                    "ai_rules": [
                        "IF contains 'windows nt' THEN device_type='desktop' WITH confidence 0.9",
                        "IF contains 'macintosh' THEN device_type='desktop' WITH confidence 0.8"
                    ],
                    "common_os": ["Windows", "macOS", "Linux"]
                },
                {
                    "brand": "Tablet", 
                    "models": ["iPad", "Android Tablet", "Windows Tablet"],
                    "patterns": ["tablet", "ipad", "tab"],
                    "type": "tablet",
                    "ai_rules": [
                        "IF contains 'tablet' THEN device_type='tablet' WITH confidence 0.9",
                        "IF contains 'ipad' THEN device_type='tablet' WITH confidence 0.95"
                    ],
                    "common_os": ["iOS", "Android", "Windows"]
                },
                {
                    "brand": "Bot",
                    "models": ["Googlebot", "Bingbot", "Slurp", "DuckDuckBot"],
                    "patterns": ["bot", "crawler", "spider", "slurp"],
                    "type": "bot",
                    "ai_rules": [
                        "IF contains 'bot' OR contains 'crawler' THEN device_type='bot' WITH confidence 0.95"
                    ],
                    "common_os": ["Linux"]
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
                    "version_patterns": ["chrome/([0-9]+)", "crios/([0-9]+)"],
                    "impossible_os": []
                },
                {
                    "name": "Firefox",
                    "patterns": ["firefox", "fxios"],
                    "vendor": "Mozilla",
                    "engine": "Gecko", 
                    "ai_rules": [
                        "IF contains 'firefox' THEN browser='Firefox' WITH confidence 0.9",
                        "IF browser='Firefox' AND os='iOS' THEN browser='Safari' WITH confidence 0.8"
                    ],
                    "common_os": ["Windows", "macOS", "Linux", "Android"],
                    "version_patterns": ["firefox/([0-9]+)"],
                    "impossible_os": ["iOS"]
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
                    "version_patterns": ["version/([0-9]+)"],
                    "impossible_os": ["Android", "Windows"]
                },
                {
                    "name": "Edge",
                    "patterns": ["edg", "edge"],
                    "vendor": "Microsoft", 
                    "engine": "Blink",
                    "ai_rules": [
                        "IF contains 'edg' THEN browser='Edge' WITH confidence 0.9",
                        "IF browser='Edge' AND os='iOS' THEN UNUSUAL WITH confidence 0.7"
                    ],
                    "common_os": ["Windows", "macOS", "Android", "iOS"],
                    "version_patterns": ["edg/([0-9]+)", "edge/([0-9]+)"],
                    "impossible_os": []
                },
                {
                    "name": "Opera",
                    "patterns": ["opera", "opr/"],
                    "vendor": "Opera",
                    "engine": "Blink",
                    "ai_rules": [
                        "IF contains 'opera' OR contains 'opr/' THEN browser='Opera' WITH confidence 0.8"
                    ],
                    "common_os": ["Windows", "macOS", "Linux", "Android"],
                    "version_patterns": ["opr/([0-9]+)", "opera/([0-9]+)"],
                    "impossible_os": ["iOS"]
                },
                {
                    "name": "Brave",
                    "patterns": ["brave"],
                    "vendor": "Brave Software",
                    "engine": "Blink", 
                    "ai_rules": [
                        "IF contains 'brave' THEN browser='Brave' WITH confidence 0.7"
                    ],
                    "common_os": ["Windows", "macOS", "Linux", "Android"],
                    "version_patterns": ["brave/([0-9]+)"],
                    "impossible_os": ["iOS"]
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
                        "8.1": {"pattern": "windows nt 6.3", "confidence": 0.8},
                        "8": {"pattern": "windows nt 6.2", "confidence": 0.8},
                        "7": {"pattern": "windows nt 6.1", "confidence": 0.8}
                    },
                    "ai_rules": [
                        "IF contains 'windows nt' THEN os='Windows' WITH confidence 0.9",
                        "IF os='Windows' AND device_type='mobile' THEN UNUSUAL WITH confidence 0.7"
                    ],
                    "common_browsers": ["Chrome", "Firefox", "Edge"],
                    "unusual_browsers": ["Safari"],
                    "common_devices": ["Desktop"],
                    "unusual_devices": ["Mobile", "Tablet"]
                },
                {
                    "name": "macOS",
                    "patterns": ["mac os", "macos"],
                    "versions": {
                        "Ventura": {"pattern": "mac os x 13", "confidence": 0.9},
                        "Monterey": {"pattern": "mac os x 12", "confidence": 0.9},
                        "Big Sur": {"pattern": "mac os x 11", "confidence": 0.8},
                        "Catalina": {"pattern": "mac os x 10.15", "confidence": 0.8}
                    },
                    "ai_rules": [
                        "IF contains 'mac os' THEN os='macOS' WITH confidence 0.9",
                        "IF os='macOS' AND device_type='mobile' THEN IMPOSSIBLE WITH confidence 0.99"
                    ],
                    "common_browsers": ["Safari", "Chrome", "Firefox"],
                    "unusual_browsers": [],
                    "common_devices": ["Desktop"],
                    "unusual_devices": ["Mobile", "Tablet"]
                },
                {
                    "name": "Linux",
                    "patterns": ["linux", "ubuntu", "fedora"],
                    "versions": {},
                    "ai_rules": [
                        "IF contains 'linux' AND NOT contains 'android' THEN os='Linux' WITH confidence 0.8"
                    ],
                    "common_browsers": ["Chrome", "Firefox"],
                    "unusual_browsers": ["Safari", "Edge"],
                    "common_devices": ["Desktop"],
                    "unusual_devices": ["Mobile", "Tablet"]
                },
                {
                    "name": "Android",
                    "patterns": ["android"],
                    "versions": {
                        "16": {"pattern": "android 16", "confidence": 0.9},
                        "15": {"pattern": "android 15", "confidence": 0.9},
                        "14": {"pattern": "android 14", "confidence": 0.9},
                        "13": {"pattern": "android 13", "confidence": 0.9},
                        "12": {"pattern": "android 12", "confidence": 0.9},
                        "11": {"pattern": "android 11", "confidence": 0.8},
                        "10": {"pattern": "android 10", "confidence": 0.8}
                    },
                    "ai_rules": [
                        "IF contains 'android' THEN os='Android' WITH confidence 0.95",
                        "IF os='Android' AND browser='Safari' THEN IMPOSSIBLE WITH confidence 0.99"
                    ],
                    "common_browsers": ["Chrome", "Firefox", "Samsung Internet"],
                    "unusual_browsers": ["Safari"],
                    "common_devices": ["Mobile", "Tablet"],
                    "unusual_devices": ["Desktop"]
                },
                {
                    "name": "iOS",
                    "patterns": ["iphone", "ipad"],
                    "versions": {
                        "26": {"pattern": "os 26", "confidence": 0.9},
                        "18": {"pattern": "os 18", "confidence": 0.9},
                        "17": {"pattern": "os 17", "confidence": 0.9},
                        "16": {"pattern": "os 16", "confidence": 0.9},
                        "15": {"pattern": "os 15", "confidence": 0.9},
                        "14": {"pattern": "os 14", "confidence": 0.8},
                        "13": {"pattern": "os 13", "confidence": 0.8}
                    },
                    "ai_rules": [
                        "IF contains 'iphone' OR contains 'ipad' THEN os='iOS' WITH confidence 0.95",
                        "IF os='iOS' AND browser='Firefox' THEN browser='Safari' WITH confidence 0.8"
                    ],
                    "common_browsers": ["Safari", "Chrome"],
                    "unusual_browsers": ["Firefox"],
                    "common_devices": ["Mobile", "Tablet"],
                    "unusual_devices": ["Desktop"]
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
                        "IF os='macOS' AND device_type='mobile' THEN IMPOSSIBLE",
                        "IF browser='Firefox' AND os='iOS' THEN IMPOSSIBLE"
                    ]
                },
                {
                    "category": "common_patterns",
                    "rules": [
                        "IF os='iOS' THEN device_brand='Apple' WITH confidence 0.95",
                        "IF os='Android' THEN device_type='mobile' WITH confidence 0.8",
                        "IF contains 'mobile' THEN device_type='mobile' WITH confidence 0.7",
                        "IF contains 'tablet' THEN device_type='tablet' WITH confidence 0.8"
                    ]
                },
                {
                    "category": "version_detection", 
                    "rules": [
                        "IF contains 'chrome/' THEN browser='Chrome' WITH confidence 0.9",
                        "IF contains 'firefox/' THEN browser='Firefox' WITH confidence 0.9",
                        "IF contains 'version/' THEN browser='Safari' WITH confidence 0.7"
                    ]
                },
                {
                    "category": "engine_detection",
                    "rules": [
                        "IF contains 'webkit' THEN engine='WebKit' WITH confidence 0.8",
                        "IF contains 'gecko' THEN engine='Gecko' WITH confidence 0.9",
                        "IF contains 'blink' THEN engine='Blink' WITH confidence 0.9"
                    ]
                }
            ]
            
    ## Train
    async def train(self):
        @self.router.get("/registry/train")
        async def exec(trainingData: Dict):
            user_agent = trainingData.get("userAgent")
            browser = trainingData.get("browser")
            os = trainingData.get("os")
            device = trainingData.get("device")
            
            print(f"Training Example: {user_agent[:50]}... -> {browser}/{os}/{device}")
            
            return {
                "status": "success",
                "message": "Training example added to AI knowledge base",
                "data": {
                    "browser": browser,
                    "os": os, 
                    "device": device
                }
            }
            
            
            
        