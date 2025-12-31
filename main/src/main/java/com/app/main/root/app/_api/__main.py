from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware
from time_stream import TimeStream
from chat.chat_service import ChatService
from chat.chat_routes import ChatRoutes
from messages.message_service import MessageService
from messages.message_routes import MessageRoutes
from connection.connection_service import ConnectionService
from connection.connection_routes import ConnectionRoutes
from session.session_service import SessionService
from session.session_routes import SessionRoutes
from user.user_service import UserService
from user.user_routes import UserRoutes
from auth.auth_service import AuthService
from auth.auth_routes import AuthRoutes
from file.file_service import FileService
from file.file_routes import FileRoutes
from __index import router as router
from config import config

class Main:
    app = FastAPI()
    
    def __init__(self):
        # URLs
        WEB_URL = config.WEB_URL
        SERVER_URL = config.SERVER_URL
        
        # REMOVE the CORS middleware from here
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
        
        ## Chat
        self.chatService = ChatService(DB_API_URL)
        self.chatRoutes = ChatRoutes(self.chatService)
        self.app.include_router(self.chatRoutes.router)
        
        ## Message
        self.messageService = MessageService(DB_API_URL)
        self.messageRoutes = MessageRoutes(self.messageService)
        self.app.include_router(self.messageRoutes.router)
        
        ## User
        self.userService = UserService(SERVER_URL)
        self.userRoutes = UserRoutes(self.userService)
        self.app.include_router(self.userRoutes.router)
        
        ## Auth
        self.authService = AuthService(SERVER_URL, self.sessionService)
        self.authRoutes = AuthRoutes(self.authService, self.userService)
        self.app.include_router(self.authRoutes.router)
        
        ## File
        self.fileService = FileService(DB_API_URL)
        self.fileRoutes = FileRoutes(self.fileService)
        self.app.include_router(self.fileRoutes.router)
        
class NoWWWAuthenticateMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        if('WWW-Authenticate' in response.headers):
            del response.headers['WWW-Authenticate']
        return response
        

# Init
instance = Main()
app = instance.app
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "*",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:3001",
        "http://127.0.0.1:3001",
        "http://localhost:3002",
        "http://127.0.0.1:3002",
        config.WEB_URL,
        config.SERVER_URL
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"]
)
app.add_middleware(NoWWWAuthenticateMiddleware)

messageService = instance.messageService

# Time Update
timeStream = instance.timeStream

def timeCallback(time: str, serverTime: bool):
    print(f"Time: {time}, Server Time: {serverTime}")

@app.on_event("startup")
async def startTimeUpdates():
    await timeStream.update(timeCallback, interval=1000)