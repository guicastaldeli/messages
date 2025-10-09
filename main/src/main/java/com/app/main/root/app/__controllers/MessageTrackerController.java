package com.app.main.root.app.__controllers;
import com.app.main.root.app.main._messages_config.MessageTracker;
import com.app.main.root.app.main._messages_config.MessageLog;
import org.springframework.web.bind.annotation.*;
import java.util.*;

@RestController
@RequestMapping("/api/message-tracker")
public class MessageTrackerController {
    private final MessageTracker messageTracker;

    public MessageTrackerController(MessageTracker messageTracker) {
        this.messageTracker = messageTracker;
    }

    /*
    * All Messages 
    */
    @GetMapping("/messages")
    public List<MessageLog> getAllMessages() {
        return messageTracker.getAllMessages();
    }

    /*
    * User 
    */
    @GetMapping("/messages/user/{username}")
    public List<MessageLog> getMessagesByUser(@PathVariable String username) {
        return messageTracker.getMessagesByUser(username);
    }

    /*
    * Chat Id 
    */
    @GetMapping("/messages/chatId/{chatId}")
    public List<MessageLog> getMessagesByChatId(@PathVariable String chatId) {
        return messageTracker.getMessagesByChatId(chatId);
    }

    /*
    * Type
    */
    @GetMapping("/messages/type/{type}")
    public List<MessageLog> getMessagesByType(@PathVariable String type) {
        MessageLog.MessageType messageType = MessageLog.MessageType.valueOf(type.toUpperCase());
        return messageTracker.getMessagesByType(messageType);
    }

    /*
    * Direction
    */
    @GetMapping("/messages/direction/{direction}")
    public List<MessageLog> getMessagesByDirection(@PathVariable String direction) {
        MessageLog.MessageDirection messageDir = MessageLog.MessageDirection.valueOf(direction.toUpperCase());
        return messageTracker.getMessagesByDirection(messageDir);
    }

    /*
    * Recent Messages 
    */
    @GetMapping("/messages/recent/{count}")
    public List<MessageLog> getRecentMessages(@PathVariable int count) {
        return messageTracker.getRecentMessages(count);
    }

    /*
    * Stats 
    */
    @GetMapping("/stats")
    public Map<String, Long> getMessageStats() {
        return messageTracker.getMessageStats();
    }

    /*
    * Count 
    */
    @GetMapping("/count")
    public int getMessageCount() {
        return messageTracker.getMessageCount();
    }

    /*
    * Clear 
    */
    @DeleteMapping("/clear")
    public String clearMessages() {
        messageTracker.clearMessages();
        return "Messages cleared!";
    }
}
