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
                if(encryptedContent != null) {
                    content = chatDecryptionService.decryptMessage(chatId, encryptedContent);
                } else {
                    content = "";
                }
                String senderId = (String) lastMessage.get("senderId");

                if(!content.isEmpty()) {
                    c.put("lastMessageTime", lastMessage.get("timestamp"));
                    c.put("lastMessageContent", content);
                    c.put("lastMessageSender", senderId);
                    chats.add(c);
                }

                c.put("lastMessageTime", lastMessage.get("timestamp"));
                c.put("lastMessageContent", content);
                c.put("lastMessageSender", senderId);
            }
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
                if(encryptedContent != null) {
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

    public List<Map<String, Object>> getUserChats(String userId, int page, int pageSize) throws SQLException {
        List<Map<String, Object>> allChats = getChats(userId);
        
        int startIndex = page * pageSize;
        int endIndex = Math.min(startIndex + pageSize, allChats.size());
        if(startIndex >= allChats.size()) return new ArrayList<>();
        
        return allChats.subList(startIndex, endIndex);
    }

    /**
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

    private boolean userHasAccessToChat(String userId, String chatId) throws SQLException {
        List<Map<String, Object>> directChats = serviceManager.getUserService().getUserDirect(userId);
        for(Map<String, Object> chat : directChats) {
            if(chatId.equals(chat.get("id"))) {
                return true;
            }
        }
        List<Map<String, Object>> groupChats = serviceManager.getUserService().getUserGroups(userId);
        for(Map<String, Object> chat : groupChats) {
            if(chatId.equals(chat.get("id"))) {
                return true;
            }
        }
        return false;
    }

    /**
     * Get Chat Data
     */
    public Map<String, Object> getChatData(
        String userId, 
        String chatId, 
        int page, 
        int pageSize
    ) throws SQLException {
        // ✅ CRITICAL FIX: Validate user has access to this chat
        if(!userHasAccessToChat(userId, chatId)) {
            throw new SecurityException("User " + userId + " does not have access to chat " + chatId);
        }
        
        Map<String, Object> chatData = new HashMap<>();
        
        try {
            List<_Message> messages = serviceManager.getMessageService().getMessagesByChatId(chatId, page, pageSize);
            
            if(messages != null) {
                List<_Message> validatedMessages = new ArrayList<>();
                for(_Message msg : messages) {
                    if(chatId.equals(msg.getChatId())) {
                        validatedMessages.add(msg);
                    } else {
                        System.err.println("WARNING: Message " + msg.getId() + 
                            " returned for chat " + chatId + 
                            " but belongs to chat " + msg.getChatId());
                    }
                }
                chatData.put("messages", validatedMessages);
            } else {
                chatData.put("messages", new ArrayList<>());
            }
            
            Map<String, Object> filesResult = serviceManager.getFileService().getFilesByChatId(userId, chatId, page, pageSize);
            List<Map<String, Object>> files = new ArrayList<>();
            if(filesResult != null && filesResult.get("files") != null) {
                files = (List<Map<String, Object>>) filesResult.get("files");
                
                List<Map<String, Object>> validatedFiles = new ArrayList<>();
                for(Map<String, Object> file : files) {
                    String fileChatId = (String) file.get("chat_id");
                    if(chatId.equals(fileChatId)) {
                        validatedFiles.add(file);
                    } else {
                        System.err.println("WARNING: File " + file.get("file_id") + 
                            " returned for chat " + chatId + 
                            " but belongs to chat " + fileChatId);
                    }
                }
                files = validatedFiles;
            }
            chatData.put("files", files);
            
            Map<String, Object> pagination = new HashMap<>();
            pagination.put("page", page);
            pagination.put("pageSize", pageSize);
            pagination.put("hasMore", messages != null && messages.size() == pageSize);
            pagination.put("totalFiles", files.size());
            chatData.put("pagination", pagination);
        } catch (SecurityException e) {
            throw e;
        } catch (Exception e) {
            chatData.put("messages", new ArrayList<>());
            chatData.put("files", new ArrayList<>());
            chatData.put("pagination", Map.of(
                "page", page,
                "pageSize", pageSize,
                "hasMore", false,
                "totalFiles", 0
            ));
        }
        
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
