package com.app.main.root.app._service;
import com.app.main.root.app._crypto.message_encoder.ChatDecryptionService;
import com.app.main.root.app._data.CommandSystemMessageList;
import com.app.main.root.app._types.File;
import com.app.main.root.app._types.Message;
import com.app.main.root.app._types.User;

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
        if(!userHasAccessToChat(userId, chatId)) {
            throw new SecurityException("User " + userId + " does not have access to chat " + chatId);
        }
        
        Map<String, Object> chatData = new HashMap<>();
        
        try {
            List<Message> messages = serviceManager.getMessageService().getMessagesByChatId(chatId, page, pageSize);
            List<Message> systemMessages = new ArrayList<>();
            
            if(chatId.startsWith("group_")) {
                List<Message> rawSystemMessages = serviceManager.getSystemMessageService().getMessagesByGroup(chatId);
                
                for(Message rawMsg : rawSystemMessages) {
                    Message personalizedMsg = new Message();
                    personalizedMsg.setId(rawMsg.getId());
                    personalizedMsg.setChatId(rawMsg.getChatId());
                    personalizedMsg.setSenderId(rawMsg.getSenderId());
                    personalizedMsg.setMessageType(rawMsg.getMessageType());
                    personalizedMsg.setCreatedAt(rawMsg.getCreatedAt());
                    personalizedMsg.setUsername(rawMsg.getUsername());
                    personalizedMsg.setSystem(true);
                    
                    String originalContent = rawMsg.getContent();
                    String personalizedContent = reapplyPerspective(
                        originalContent, 
                        rawMsg.getMessageType(), 
                        userId
                    );
                    
                    personalizedMsg.setContent(personalizedContent);
                    systemMessages.add(personalizedMsg);
                }
            }
            
            List<Message> validatedMessages = new ArrayList<>();
            if(messages != null) {
                for(Message msg : messages) {
                    if(chatId.equals(msg.getChatId())) {
                        validatedMessages.add(msg);
                    } else {
                        System.err.println("WARNING: Message " + msg.getId() + 
                            " returned for chat " + chatId + 
                            " but belongs to chat " + msg.getChatId());
                    }
                }
            }

            List<Message> allMessages = new ArrayList<>();
            allMessages.addAll(validatedMessages);
            allMessages.addAll(systemMessages);
            chatData.put("messages", allMessages);
            
            List<File> files = serviceManager.getFileService().getFilesByChatId(userId, chatId, page, pageSize);
            if(files != null) {
                List<File> validatedFiles = new ArrayList<>();
                for(File file : files) {
                    if(chatId.equals(file.getChatId())) {
                        validatedFiles.add(file);
                    } else {
                        System.err.println("WARNING: File " + file.getFileId() + 
                            " returned for chat " + chatId + 
                            " but belongs to chat " + file.getChatId());
                    }
                }
                files = validatedFiles;
            }
            
            List<Map<String, Object>> timeline = new ArrayList<>();
            for(Message msg : validatedMessages) {
                if(chatId.equals(msg.getChatId())) {
                    Map<String, Object> timelineItem = createTimelineItemMessage(msg, "message");
                    timeline.add(timelineItem);
                }
            }
            for(Message sysMsg : systemMessages) {
                if(chatId.equals(sysMsg.getChatId())) {
                    Map<String, Object> timelineItem = createTimelineItemMessage(sysMsg, "system");
                    timeline.add(timelineItem);
                }
            }

            if(files != null) {
                for(File file : files) {
                    Map<String, Object> timelineItem = new HashMap<>();
                    timelineItem.put("type", "file");
                    timelineItem.put("id", "file_" + file.getFileId());
                    timelineItem.put("senderId", file.getSenderId());
                    timelineItem.put("messageId", "file_" + file.getFileId());
                    timelineItem.put("fileData", file);
                    timelineItem.put("content", file.getOriginalFileName());
                    timelineItem.put("chatId", file.getChatId());
                    timelineItem.put("userId", userId);

                    Timestamp uploadedAt = file.getUploadedAt();
                    long timestamp = uploadedAt != null ? uploadedAt.getTime() : System.currentTimeMillis();
                    String createdAtStr = new Timestamp(timestamp).toString();
                    
                    timelineItem.put("timestamp", timestamp);
                    timelineItem.put("createdAt", createdAtStr);
                    timeline.add(timelineItem);
                }
            }

            timeline.sort((a, b) -> {
                Long timeA = getTimestampItem(a);
                Long timeB = getTimestampItem(b);
                return timeB.compareTo(timeA);
            });

            int totalItems = timeline.size();
            int startIndex = Math.max(0, totalItems - ((page + 1) * pageSize));
            int endIndex = totalItems - (page * pageSize);
            
            startIndex = Math.max(0, startIndex);
            endIndex = Math.min(totalItems, endIndex);

            chatData.put("timeline", timeline);
            chatData.put("messages", messages != null ? messages : new ArrayList<>());
            chatData.put("files", files != null ? files : new ArrayList<>());
            
            Map<String, Object> pagination = new HashMap<>();
            pagination.put("page", page);
            pagination.put("pageSize", pageSize);
            pagination.put("hasMore", timeline.size() > endIndex);
            pagination.put("totalItems", timeline.size());
            pagination.put("totalFiles", files != null ? files.size() : 0);
            chatData.put("pagination", pagination);
        } catch(SecurityException e) {
            throw e;
        } catch(Exception e) {
            e.printStackTrace();
            chatData.put("timeline", new ArrayList<>());
            chatData.put("messages", new ArrayList<>());
            chatData.put("files", new ArrayList<>());
            chatData.put("pagination", Map.of(
                "page", page,
                "pageSize", pageSize,
                "hasMore", false,
                "totalItems", 0,
                "totalFiles", 0
            ));
        }
        
        return chatData;
    }

    /**
     * Create Timeline Item Message
     */
    private Map<String, Object> createTimelineItemMessage(Message msg, String type) {
        Map<String, Object> timelineItem = new HashMap<>();
        timelineItem.put("type", type);
        timelineItem.put("id", msg.getId());
        timelineItem.put("messageId", msg.getId());
        timelineItem.put("content", msg.getContent());
        timelineItem.put("contentBytes", msg.getContentBytes());
        timelineItem.put("senderId", msg.getSenderId());
        timelineItem.put("chatId", msg.getChatId());
        
        Timestamp createdAt = msg.getCreatedAt();
        long timestamp;
        String createdAtStr;
        if(createdAt != null) {
            timestamp = createdAt.getTime();
            createdAtStr = createdAt.toString();
        } else {
            timestamp = System.currentTimeMillis();
            createdAtStr = new Timestamp(timestamp).toString();
        }
        
        timelineItem.put("createdAt", createdAtStr);
        timelineItem.put("timestamp", timestamp);
        timelineItem.put("messageType", msg.getMessageType());
        timelineItem.put("username", msg.getUsername());
        timelineItem.put("isSystem", msg.isSystem());
        
        return timelineItem;
    }

    private Long getTimestampItem(Map<String, Object> item) {
        Object timestamp = item.get("timestamp");
        if(timestamp instanceof Long) return (Long) timestamp;
        if(timestamp instanceof Timestamp) return ((Timestamp) timestamp).getTime();
        if(timestamp instanceof Integer) return ((Integer) timestamp).longValue();
        if(timestamp instanceof String) {
            try {
                return Timestamp.valueOf((String) timestamp).getTime();
            } catch(Exception e) {
                return 0L;
            }
        }
        return 0L;
    }

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

    private String reapplyPerspective(String content, String messageType, String userId) {
        if(content == null || userId == null || messageType == null) {
            return content;
        }
        
        try {
            String targetUsername = serviceManager.getUserService().getUsernameByUserId(userId);
            if(targetUsername == null) return content;
            
            String originalTemplate = getOriginalTemplate(messageType);
            if(originalTemplate == null) return content;
            
            Map<String, String> extractedParams = extractParametersFromContent(content, originalTemplate);
            return applyPerspectiveLogic(content, extractedParams, userId, targetUsername);
        } catch(Exception e) {
            System.err.println("Error reapplying perspective: " + e.getMessage());
            e.printStackTrace();
            return content;
        }
    }

    private String getOriginalTemplate(String messageType) {
        try {
            CommandSystemMessageList templateEnum = CommandSystemMessageList.valueOf(messageType);
            return templateEnum.get();
        } catch(IllegalArgumentException e) {
            return null;
        }
    }

    private Map<String, String> extractParametersFromContent(String content, String template) {
        Map<String, String> params = new HashMap<>();
        
        String[] templateParts = template.split("\\{([^}]+)\\}");
        for(int i = 0; i < templateParts.length; i++) {
            String templatePart = templateParts[i].trim();
            if(!templatePart.isEmpty()) {
                int startIndex = content.indexOf(templatePart);
                if(startIndex != -1 && i < templateParts.length - 1) {
                    int nextPartIndex = content.indexOf(templateParts[i + 1], startIndex + templatePart.length());
                    if(nextPartIndex != -1) {
                        String paramValue = content.substring(
                            startIndex + templatePart.length(), 
                            nextPartIndex
                        ).trim();
                        if(i < templateParts.length - 1) {
                            String paramName = extractParamName(template, templatePart);
                            if(paramName != null) {
                                params.put(paramName, paramValue);
                            }
                        }
                    }
                }
            }
        }
        
        return params;
    }

    private String extractParamName(String template, String precedingText) {
        int paramStart = template.indexOf(precedingText) + precedingText.length();
        if(paramStart < template.length() && template.charAt(paramStart) == '{') {
            int paramEnd = template.indexOf('}', paramStart);
            if(paramEnd != -1) {
                return template.substring(paramStart + 1, paramEnd);
            }
        }
        return null;
    }

    private String applyPerspectiveLogic(String content, Map<String, String> params, String userId, String targetUsername) {
        String result = content;
        
        for(Map.Entry<String, String> entry : params.entrySet()) {
            String paramName = entry.getKey();
            String paramValue = entry.getValue();
            
            if(isValueReferringToCurrentUser(paramValue, userId)) {
                if(paramName.contains("username") || paramName.contains("Username")) {
                    result = result.replace(paramValue, "You");
                } else if(paramName.contains("inviter") || paramName.contains("Inviter")) {
                    result = result.replace(paramValue, "You");
                }
            }
        }
        
        return result;
    }

    private boolean isValueReferringToCurrentUser(String paramValue, String userId) {
        if(paramValue == null) return false;
        
        try {
            String usernameFromValue = paramValue.trim();
            String actualUsername = serviceManager.getUserService().getUsernameByUserId(userId);
            if(usernameFromValue.equals(actualUsername)) {
                return true;
            }
            
            User userFromValue = serviceManager.getUserService().getUserIdByUsername(usernameFromValue);
            if(userFromValue != null && userId.equals(userFromValue.getId())) {
                return true;
            }
            
        } catch(Exception e) {
            return false;
        }
        
        return false;
    }
}
