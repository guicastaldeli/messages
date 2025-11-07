package com.app.main.root.app.__controllers;
import com.app.main.root.app.main._messages_config.MessageTracker;
import com.app.main.root.app.main._messages_config.MessageLog;
import com.app.main.root.app._service.ServiceManager;
import com.app.main.root.app._types._Message;
import com.app.main.root.app._types._RecentChat;
import org.springframework.context.annotation.Lazy;
import org.springframework.web.bind.annotation.*;
import java.sql.SQLException;
import java.util.*;

@RestController
@RequestMapping("/api/message-tracker")
public class MessageTrackerController {
    private final MessageTracker messageTracker;
    private final ServiceManager serviceManager;

    public MessageTrackerController(
        MessageTracker messageTracker,
        @Lazy ServiceManager serviceManager
    ) {
        this.messageTracker = messageTracker;
        this.serviceManager = serviceManager;
    }

    /*
    * Save 
    */
    @PostMapping("/messages")
    public MessageLog saveMessage(@RequestBody Map<String, Object> data) {
        try {
            Date time = new Date();
            String messageId = (String) data.get("messageId");
            String content = (String) data.get("content");
            String senderId = (String) data.get("senderId");
            String username = (String) data.get("username");
            String chatId = (String) data.get("chatId");
            MessageLog.MessageType messageType = MessageLog.MessageType.valueOf(((String) data.get("messageType")).toUpperCase());
            MessageLog.MessageDirection direction = MessageLog.MessageDirection.valueOf(((String) data.get("direction")).toUpperCase());
            serviceManager.getMessageService().saveMessage(chatId, senderId, content, messageType.name(), username);
            MessageLog log = new MessageLog(messageId, content, senderId, username, chatId, messageType, direction, time);
            messageTracker.track(
                messageId, 
                content, 
                senderId, 
                username, 
                chatId, 
                messageType, 
                direction
            );
            return log;
        } catch(SQLException err) {
            throw new RuntimeException("Error tracker coneoller", err);
        }
    }

    /*
    * All Messages 
    */
    @GetMapping("/get-messages")
    public List<_Message> getAllMessages() throws SQLException {
        return serviceManager.getMessageService().getAllMessages();
    }

    /*
    * Chat Id 
    */
    @GetMapping("/messages/chatId/{chatId}")
    public List<_Message> getMessagesByChatId(
        @PathVariable String chatId,
        @RequestParam(defaultValue = "0") int page,
        @RequestParam(defaultValue = "100") int pageSize
    ) throws SQLException {
        return serviceManager.getMessageService().getMessagesByChatId(chatId, page, pageSize);
    }

    public Map<String, Object> getMessageCountByChatId(@PathVariable String chatId) throws SQLException {
        int count = serviceManager.getMessageService().getMessageCountByChatId(chatId);
        Map<String, Object> res = new HashMap<>();
        res.put("chatId", chatId);
        res.put("count", count);
        return res;
    }

    /*
    * Recent Messages 
    */
    @GetMapping("/messages/recent/{userId}")
    public List<_RecentChat> getRecentMessages(
        @PathVariable String userId, 
        @RequestParam(defaultValue = "0") int page,
        @RequestParam(defaultValue = "20") int pageSize
    ) throws SQLException {
        return serviceManager.getMessageService().getRecentChats(userId, page, pageSize);
    }

    @GetMapping("/messages/recent/{userId}/count")
    public Map<String, Object> getRecentChatsCount(@PathVariable String userId) throws SQLException {
        int count = serviceManager.getMessageService().getRecentChatsCount(userId);
        Map<String, Object> res = new HashMap<>();
        res.put("userId", userId);
        res.put("count", count);
        return res;
    }

    /*
    * User 
    */
    @GetMapping("/messages/userId/{userId}")
    public List<_Message> getMessagesByUserId(@PathVariable String userId) throws SQLException {
        return serviceManager.getMessageService().getMessagesByUserId(userId);
    }

    /*
    * Stats 
    */
    @GetMapping("/stats")
    public Map<String, Long> getMessageStats() throws SQLException {
        return messageTracker.getMessageStats();
    }

    /*
    * Count 
    */
    @GetMapping("/count")
    public int getMessageCount() throws SQLException {
        return messageTracker.getMessageCount();
    }

    /*
    * Clear 
    */
    @DeleteMapping("/clear")
    public void clearMessages() throws SQLException {
        messageTracker.clearMessages();
    }
}
