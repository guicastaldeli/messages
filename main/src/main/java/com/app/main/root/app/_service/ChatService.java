package com.app.main.root.app._service;
import com.app.main.root.app._crypto.message_encoder.ChatDecryptionService;
import com.app.main.root.app._types._Message;

import org.springframework.context.annotation.Lazy;
import org.springframework.stereotype.Component;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.*;

@Component
public class ChatService {
    private final ServiceManager serviceManager;
    private final ChatDecryptionService chatDecryptionService;

    public ChatService(@Lazy ServiceManager serviceManager, @Lazy ChatDecryptionService ChatDecryptionService) {
        this.serviceManager = serviceManager;
        this.chatDecryptionService = ChatDecryptionService;
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
                    content = chatDecryptionService.decryptMessage(chatId, encryptedContent);
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
                    content = chatDecryptionService.decryptMessage(chatId, encryptedContent);
                } else {
                    content = "";
                }
                String senderId = (String) lastMessage.get("senderId");

                c.put("lastMessageTime", lastMessage.get("timestamp"));
                c.put("lastMessageContent", content);
                c.put("lastMessageSender", senderId);
                System.out.println(content);
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

    public Map<String, Object> getChatData(String userId, String chatId, int page, int pageSize) throws SQLException {
        Map<String, Object> chatData = new HashMap<>();
        
        List<_Message> messages = serviceManager.getMessageService().getMessagesByChatId(chatId, page, pageSize);
        chatData.put("messages", messages);
        
        Map<String, Object> filesResult = serviceManager.getFileService().listFiles(userId, chatId, page, pageSize);
        chatData.put("files", filesResult.get("files"));
        chatData.put("filesPagination", filesResult.get("pagination"));
        
        chatData.put("chatId", chatId);
        chatData.put("userId", userId);
        chatData.put("page", page);
        chatData.put("pageSize", pageSize);
        
        return chatData;
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
