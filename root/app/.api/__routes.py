from __main import DbService, app

class Routes:
    def __init__(self, app, dbService: DbService):
        self.app = app
        self.dbService = dbService
    
    @app.get("/api/messages")
    async def getMessages(self, chatId: str):
        return await self.dbService.getMessagesByChatId(chatId)
    
    @app.get("/api/recent-chats")
    async def getRecentChats(self, userId: str = ""):
        return await self.dbService.getRecentChats(userId)
        