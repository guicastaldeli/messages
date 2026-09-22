import os
from dotenv import load_dotenv
from typing import Any

class Config:
    _instance = None
    _loaded = False
    
    def __new__(cls):
        if(cls._instance) is None:
            cls._instance = super(Config, cls).__new__(cls)
        return cls._instance
    
    def __init__(self):
        if(not self._loaded):
            self.loadEnv()
            self._loaded = True
            
    def loadEnv(self):
        self.env = os.getenv('APP_ENV', 'dev')
        
        filename = f'.env.{self.env}'   
        paths = [
            os.getenv('ENV_FILE_PATH'),
            f'../../.env-config/{filename}',
            f'/app/.env-config/{filename}',
            os.path.join(os.path.dirname(__file__), '..', '..', '.env-config', filename),
            os.path.join(os.path.dirname(__file__), '.env-config', filename)
        ]
        
        envFile = None
        for path in paths:
                if path and os.path.isfile(path):
                        envFile = path
                        break
                    
        if envFile:
            print(f"Loading {self.env} from: {envFile}")
            load_dotenv(envFile)
        else:
            print(f"WARNING: .env.{self.env} not found in any of the expected locations")
            print(f"Tried: {paths}")
        
        self.WEB_URL = os.getenv('WEB_URL')
        self.SERVER_URL = os.getenv('SERVER_URL')
        self.SERVER_ALT_URL = os.getenv('SERVER_ALT_URL')
        self.SERVER_INSTANCES = os.getenv('SERVER_INSTANCES')
        self.SERVER_DEF_HTTP_URL = os.getenv('SERVER_DEF_HTTP_URL')
        self.API_URL = os.getenv('API_URL')
        self.TEST = os.getenv('TEST')
        
        print(f"Config loaded")
        print(f"Environment: {self.env}")
        print(f"Web URL: {self.WEB_URL}")
        print(f"Server URL: {self.SERVER_URL}")
    
    def get(
        self,
        key: str,
        default: Any = None
    ) -> Any:
        return os.getenv(key, default)
config = Config()