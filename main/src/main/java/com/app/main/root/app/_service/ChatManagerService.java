package com.app.main.root.app._service;
import com.app.main.root.app._crypto.message_encoder.ClientChatDecryptionService;
import org.springframework.context.annotation.Lazy;
import org.springframework.stereotype.Component;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.*;

@Component
public class ChatManagerService {
    private final ServiceManager serviceManager;
    private final ClientChatDecryptionService clientChatDecryptionService;

    public ChatManagerService(
        @Lazy ServiceManager serviceManager,
        @Lazy ClientChatDecryptionService clientChatDecryptionService
    ) {
        this.serviceManager = serviceManager;
        this.clientChatDecryptionService = clientChatDecryptionService;
    }

    private List<Map<String, Object>> getUserDirectChats(String userId) throws SQLException {
        List<Map<String, Object>> chatData = serviceManager.getUserService().getUserDirect(userId);
        List<Map<String, Object>> chats = new ArrayList<>();
        for(Map<String, Object> chat : chatData) {
            String chatId = (String) chat.get("id");
            Map<String, Object> lastMessage = serviceManager.getMessageService().getLastMessagesByChatId(chatId);
            Map<String, Object> c = new HashMap<>(chat);
            if(lastMessage != null) {
                byte[] encryptedContent = (byte[]) lastMessage.get("contentBytes");
                String content;
                if (encryptedContent != null) {
                    content = clientChatDecryptionService.decryptMessage(chatId, encryptedContent);
                } else {
                    content = "";
                }
                String senderId = (String) lastMessage.get("senderId");

                c.put("lastMessageTime", lastMessage.get("timestamp"));
                c.put("lastMessageContent", content);
                c.put("lastMessageSender", senderId);
            }
            chats.add(c);
        }
        return chats;
    }

    private List<Map<String, Object>> getUserGroupChats(String userId) throws SQLException {
        List<Map<String, Object>> chatData = serviceManager.getUserService().getUserGroups(userId);
        List<Map<String, Object>> chats = new ArrayList<>();
        for(Map<String, Object> chat : chatData) {
            String chatId = (String) chat.get("id");
            Map<String, Object> lastMessage = serviceManager.getMessageService().getLastMessagesByChatId(chatId);
            Map<String, Object> c = new HashMap<>(chat);
            if(lastMessage != null) {
                byte[] encryptedContent = (byte[]) lastMessage.get("contentBytes");
                String content;
                if (encryptedContent != null) {
                    content = clientChatDecryptionService.decryptMessage(chatId, encryptedContent);
                } else {
                    content = "";
                }
                String senderId = (String) lastMessage.get("senderId");

                c.put("lastMessageTime", lastMessage.get("timestamp"));
                c.put("lastMessageContent", content);
                c.put("lastMessageSender", senderId);
            }
            chats.add(c);
        }
        return chats;
    }

    /*
    * Get Chats 
    */
    public List<Map<String, Object>> getChats(String userId) throws SQLException {
        List<Map<String, Object>> allChats = new ArrayList<>();
        List<Map<String, Object>> directChats = getUserDirectChats(userId);
        List<Map<String, Object>> groupChats = getUserGroupChats(userId);
        allChats.addAll(directChats);
        allChats.addAll(groupChats);

        allChats.sort((a, b) -> {
            Timestamp timeA = getTimestamp(a.get("lastMessageTime"));
            Timestamp timeB = getTimestamp(b.get("lastMessageTime"));
            Timestamp createA = parseCreatedAt((String) a.get("createdAt"));
            Timestamp createB = parseCreatedAt((String) b.get("createdAt"));

            if(timeA != null && timeB != null) {
                return timeB.compareTo(timeA);
            } else if(timeA != null) {
                return -1;
            } else if(timeB != null) {
                return -1;
            } else {
                return createB.compareTo(createA);
            }
        });

        return allChats;
    }

    /*
    * Timestamp 
    */
    private Timestamp getTimestamp(Object timestampObj) {
        if(timestampObj == null) return null;
        if(timestampObj instanceof Timestamp) {
            return (Timestamp) timestampObj;
        } else if(timestampObj instanceof String) {
            try {
                Timestamp.valueOf((String) timestampObj);
            } catch(Exception err) {
                return null;
            }
        }
        return null;
    }

    private Timestamp parseCreatedAt(String createdAt) {
        if(createdAt == null) return new Timestamp(0);
        try {
            if(createdAt.contains("T") || createdAt.contains("t")) {
                LocalDateTime dateTime = LocalDateTime.parse(
                    createdAt, 
                    DateTimeFormatter.ISO_LOCAL_DATE_TIME
                );
                return Timestamp.valueOf(dateTime);
            } else {
                return Timestamp.valueOf(createdAt);
            }
        } catch(Exception err) {
            return new Timestamp(System.currentTimeMillis());
        }
    }
}
