from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from time_stream import TimeStream
from messages.message_service import MessageService
from messages.message_routes import MessageRoutes
from connection.connection_service import ConnectionService
from connection.connection_routes import ConnectionRoutes
from session.session_service import SessionService
from session.session_routes import SessionRoutes
from user.user_service import UserService
from user.user_routes import UserRoutes
from __index import router as router
from config import config

class Main:
    app = FastAPI()
    
    def __init__(self):
        # URLs
        WEB_URL = config.WEB_URL
        SERVER_URL = config.SERVER_URL
        
        self.app.add_middleware(
            CORSMiddleware,
            allow_origins=[WEB_URL, SERVER_URL],
            allow_methods=["*"],
            allow_headers=["*"]
        )
        DB_API_URL = SERVER_URL
        TIME_API_URL = SERVER_URL
        SESSION_API_URL = SERVER_URL
        CONNECTIONS_API_URL = SERVER_URL
        
        ## Router
        self.app.include_router(router)
        
        ## Time
        self.timeStream = TimeStream(TIME_API_URL)
        self.app.include_router(self.timeStream.router)
        
        ## Connection
        self.connectionService = ConnectionService(CONNECTIONS_API_URL)
        self.connectionRoutes = ConnectionRoutes(self.connectionService)
        self.app.include_router(self.connectionRoutes.router)
        
        ## Session
        self.sessionService = SessionService(SESSION_API_URL)
        self.sessionRoutes = SessionRoutes(self.sessionService)
        self.app.include_router(self.sessionRoutes.router)
        
        ## Message
        self.messageService = MessageService(DB_API_URL)
        self.messageRoutes = MessageRoutes(self.messageService)
        self.app.include_router(self.messageRoutes.router)
        
        ## User
        self.userService = UserService(SERVER_URL)
        self.userRoutes = UserRoutes(self.userService)
        self.app.include_router(self.userRoutes.router)
        

# Init
instance = Main()
app = instance.app
timeStream = instance.timeStream
messageService = instance.messageService

# Time Update
def timeCallback(time: str, serverTime: bool):
    print(f"Time: {time}, Server Time: {serverTime}")

@app.on_event("startup")
async def startTimeUpdates():
    await timeStream.update(timeCallback, interval=1000)