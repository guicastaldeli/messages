package com.app.main.root.app.__controllers;
import com.app.main.root.app._service.ServiceManager;
import com.app.main.root.app._types.Message;
import com.app.main.root.app._types.RecentChat;
import com.app.main.root.app.main.chat.messages.MessageLog;
import com.app.main.root.app.main.chat.messages.MessageTracker;
import org.springframework.context.annotation.Lazy;
import org.springframework.web.bind.annotation.*;
import java.sql.SQLException;
import java.util.*;

@RestController
@RequestMapping("/api/message")
public class MessageController {
    private final MessageTracker messageTracker;
    private final ServiceManager serviceManager;

    public MessageController(
        MessageTracker messageTracker,
        @Lazy ServiceManager serviceManager
    ) {
        this.messageTracker = messageTracker;
        this.serviceManager = serviceManager;
    }

    /**
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
            throw new RuntimeException("Error tracker controller", err);
        }
    }

    /**
     * All Messages
     */
    @GetMapping("/get-messages")
    public List<Message> getAllMessages() throws SQLException {
        return serviceManager.getMessageService().getAllMessages();
    }

    /**
     * Chat Id
     */
    @GetMapping("/messages/chatId/{chatId}")
    public Map<String, Object> getMessagesByChatId(
        @PathVariable String chatId,
        @RequestParam(defaultValue = "0") int page,
        @RequestParam(defaultValue = "20") int pageSize
    ) {
        try {
            List<Message> messages = serviceManager.getMessageService().getMessagesByChatId(chatId, page, pageSize);
            int totalCount = serviceManager.getMessageService().getMessageCountByChatId(chatId);
            boolean hasMore = (page + 1) * pageSize < totalCount;
            
            Map<String, Object> response = new HashMap<>();
            response.put("messages", messages);
            response.put("chatId", chatId);
            response.put("page", page);
            response.put("pageSize", pageSize);
            response.put("total", totalCount);
            response.put("hasMore", hasMore);
            
            return response;
        } catch(SQLException err) {
            throw new RuntimeException("Error fetching messages for chat: " + chatId, err);
        }
    }

    @GetMapping("/messages/chatId/{chatId}/count")
    public Map<String, Object> getMessageCountByChatId(@PathVariable String chatId) {
        try {
            int count = serviceManager.getMessageService().getMessageCountByChatId(chatId);
            Map<String, Object> res = new HashMap<>();
            res.put("chatId", chatId);
            res.put("count", count);
            res.put("success", true);
            return res;
        } catch(SQLException err) {
            Map<String, Object> errorRes = new HashMap<>();
            errorRes.put("success", false);
            errorRes.put("error", err.getMessage());
            errorRes.put("chatId", chatId);
            errorRes.put("count", 0);
            return errorRes;
        }
    }

    /*
    * Recent Messages
    */
    @GetMapping("/messages/recent/{userId}")
    public Map<String, Object> getRecentMessages(
        @PathVariable String userId, 
        @RequestParam(defaultValue = "0") int page,
        @RequestParam(defaultValue = "20") int pageSize
    ) {
        try {
            int offset = page * pageSize;
            List<RecentChat> chats = serviceManager.getMessageService().getRecentChats(userId, pageSize, offset);
            int totalCount = serviceManager.getMessageService().getRecentChatsCount(userId);
            boolean hasMore = (page + 1) * pageSize < totalCount;
            
            Map<String, Object> response = new HashMap<>();
            response.put("chats", chats);
            response.put("userId", userId);
            response.put("page", page);
            response.put("pageSize", pageSize);
            response.put("total", totalCount);
            response.put("hasMore", hasMore);
            
            return response;
        } catch(SQLException err) {
            throw new RuntimeException("Error fetching recent chats for user: " + userId, err);
        }
    }

    @GetMapping("/messages/recent/{userId}/count")
    public Map<String, Object> getRecentChatsCount(@PathVariable String userId) {
        try {
            int count = serviceManager.getMessageService().getRecentChatsCount(userId);
            Map<String, Object> res = new HashMap<>();
            res.put("userId", userId);
            res.put("count", count);
            res.put("success", true);
            return res;
        } catch(SQLException err) {
            Map<String, Object> errorRes = new HashMap<>();
            errorRes.put("success", false);
            errorRes.put("error", err.getMessage());
            errorRes.put("userId", userId);
            errorRes.put("count", 0);
            return errorRes;
        }
    }

    /**
     * Get By User Id
     */
    @GetMapping("/messages/userId/{userId}")
    public List<Message> getMessagesByUserId(@PathVariable String userId) throws SQLException {
        if(userId == null || userId.equals("null") || userId.trim().isEmpty()) {
            return new ArrayList<>();
        }
        return serviceManager.getMessageService().getMessagesByUserId(userId);
    }

    /**
     * Stats
     */
    @GetMapping("/stats")
    public Map<String, Long> getMessageStats() throws SQLException {
        return messageTracker.getMessageStats();
    }

    /**
     * Count 
     */
    @GetMapping("/count")
    public int getMessageCount() throws SQLException {
        return messageTracker.getMessageCount();
    }

    /**
     * Clear 
     */
    @DeleteMapping("/clear")
    public void clearMessages() throws SQLException {
        messageTracker.clearMessages();
    }
}