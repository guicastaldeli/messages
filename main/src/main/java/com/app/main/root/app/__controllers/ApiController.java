package com.app.main.root.app.__controllers;
import com.app.main.root.app._db.DbService;
import com.app.main.root.app._db.types._Message;
import com.app.main.root.app._db.types._RecentChat;
import com.app.main.root.app._db.types._User;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;
import java.util.*;

@RestController
@RequestMapping("/api")
@CrossOrigin(origins = "*")
public class ApiController {
    @Autowired
    private DbService dbService;

    @GetMapping("/messages")
    public List<Map<_Message>> getMessages(@RequestParam String chatId) {
        return dbService.messagesConfig.getMessagesByChatId(chatId, 100);
    }

    @GetMapping("/recent-chats")
    public List<_RecentChat> getRecentChats(@RequestParam(required = false) String userId) {
        return dbService.messagesConfig.getRecentChats(userId, 100);
    }

    @GetMapping("/users/{userId}")
    public Map<_User> getUserById(@PathVariable String userId) {
        return dbService.usersConfig.getUserById(userId);
    }
}
