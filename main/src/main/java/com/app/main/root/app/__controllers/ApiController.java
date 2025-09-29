package com.app.main.root.app.__controllers;
import com.app.main.root.app._db.DbService;
import com.app.main.root.app._db.MessagesConfig;
import com.app.main.root.app._types._Message;
import com.app.main.root.app._types._RecentChat;
import com.app.main.root.app._types._User;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.sql.SQLException;
import java.util.*;

@RestController
@RequestMapping("/api")
@CrossOrigin(origins = "*")
public class ApiController {

    private final MessagesConfig messagesConfig;
    @Autowired
    private DbService dbService;

    ApiController(MessagesConfig messagesConfig) {
        this.messagesConfig = messagesConfig;
    }

    @GetMapping("/messages")
    public ResponseEntity<List<_Message>> getMessages(@RequestParam String chatId) {
        try {
            List<_Message> messages = dbService.messagesConfig.getMessagesByChatId(chatId, 100);
            return ResponseEntity.ok(messages);
        } catch(Exception err) {
            System.err.println("Error getting messages:" + err.getMessage());
            return ResponseEntity.badRequest().body(Collections.emptyList());
        }
    }

    @GetMapping("/recent-chats")
    public ResponseEntity<List<_RecentChat>> getRecentChats(@RequestParam(required = false) String userId) {
        try {
            List<_RecentChat> chats = dbService.messagesConfig.getRecentChats(userId, 100);
            return ResponseEntity.ok(chats);
        } catch (SQLException e) {
            System.err.println("SQL Error getting recent chats: " + e.getMessage());
            return ResponseEntity.internalServerError().body(Collections.emptyList());
        } catch (Exception e) {
            System.err.println("Error getting recent chats: " + e.getMessage());
            return ResponseEntity.badRequest().body(Collections.emptyList());
        }
    }

    @GetMapping("/users/{userId}")
    public ResponseEntity<_User> getUserById(@PathVariable String userId) {
        try {
            _User user = dbService.usersConfig.getUserById(userId);
            if(user != null) {
                return ResponseEntity.ok(user);
            } else {
                return ResponseEntity.notFound().build();
            }
        } catch (SQLException e) {
            System.err.println("SQL Error getting user: " + e.getMessage());
            return ResponseEntity.internalServerError().build();
        } catch (Exception e) {
            System.err.println("Error getting user: " + e.getMessage());
            return ResponseEntity.badRequest().build();
        }
    }
}
