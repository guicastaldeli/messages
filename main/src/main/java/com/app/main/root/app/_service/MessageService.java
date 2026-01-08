package com.app.main.root.app._service;
import com.app.main.root.app._data.MessagePerspectiveResult;
import com.app.main.root.app._db.CommandQueryManager;
import com.app.main.root.app._db.DataSourceService;
import com.app.main.root.app._cache.CacheService;
import com.app.main.root.app._cache.ChatCache;
import com.app.main.root.app._types.Message;
import com.app.main.root.app._types.RecentChat;
import com.app.main.root.app.main.chat.messages.MessageLog;
import com.app.main.root.app.main.chat.messages.MessageTracker;
import com.app.main.root.app.__controllers.UserController;
import com.app.main.root.app._crypto.message_encoder.PreKeyBundle;
import com.app.main.root.app._crypto.message_encoder.SecureMessageService;
import com.app.main.root.app._data.MessageAnalyzer;
import com.app.main.root.app._data.MessagePerspectiveDetector;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Lazy;
import org.springframework.stereotype.Component;
import javax.sql.DataSource;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.nio.charset.StandardCharsets;
import java.sql.*;
import java.time.Instant;

@Component
public class MessageService {
    private final UserController userController;
    private final DataSourceService dataSourceService;
    private final ServiceManager serviceManager;
    private final MessageTracker messageTracker;
    private final MessageAnalyzer messageAnalyzer;
    private final MessagePerspectiveDetector perspectiveDetector;
    private final CacheService cacheService;
    @Autowired @Lazy private SecureMessageService secureMessageService;

    public MessageService(
        DataSourceService dataSourceService, 
        @Lazy ServiceManager serviceManager,
        MessageTracker messageTracker,
        MessageAnalyzer messageAnalyzer,
        MessagePerspectiveDetector messagePerspectiveDetector, 
        UserController userController,
        CacheService cacheService
    ) {
        this.dataSourceService = dataSourceService;
        this.serviceManager = serviceManager;
        this.messageTracker = messageTracker;
        this.messageAnalyzer = messageAnalyzer;
        this.perspectiveDetector = messagePerspectiveDetector;
        this.userController = userController;
        this.cacheService = cacheService;
    }

    private Connection getConnection() throws SQLException {
        return dataSourceService.setDb("message_service").getConnection();
    }

    /**
     * Save Message
     */
    public int saveMessage(
        String chatId,
        String senderId,
        String content,
        String type,
        String username
    ) throws SQLException {
        String query = CommandQueryManager.SAVE_MESSAGE.get();
        int keys = Statement.RETURN_GENERATED_KEYS;

        try(
            Connection conn = getConnection();
            PreparedStatement stmt = conn.prepareStatement(query, keys)
        ) {
            String fType = type != null ? type : "text";
            byte[] messageContent;
            String finalContent;
            boolean isEncrypted = false;

            try {
                String encryptionKey = chatId;
                if(secureMessageService.hasActiveSession(encryptionKey)) {
                    byte[] encryptedBytes = secureMessageService.encryptMessage(encryptionKey, content);
                    if(encryptedBytes != null && encryptedBytes.length > 0) {
                        messageContent = encryptedBytes;
                        finalContent = "[ENCRYPTED]";
                        isEncrypted = true;
                        System.out.println("Message encrypted successfully: " + encryptedBytes.length);
                    } else {
                        throw new Exception("Encryption returned null or empty");
                    }
                } else {
                    messageContent = content.getBytes(StandardCharsets.UTF_8);
                    finalContent = content;
                    System.out.println("No encryption session, storing as plain text");
                }
            } catch(Exception err) {
                System.err.println("Encryption failed, using plainText: " + err.getMessage());
                messageContent = content.getBytes(StandardCharsets.UTF_8);
                finalContent = content;
            }

            Instant now = Instant.now();
            Timestamp createdAt = Timestamp.from(now);

            stmt.setString(1, chatId);
            stmt.setString(2, senderId);
            stmt.setBytes(3, messageContent);
            stmt.setString(4, fType);
            stmt.setString(5, username);
            stmt.setTimestamp(6, createdAt);

            int affectedRows = stmt.executeUpdate();
            if(affectedRows > 0) {
                try(ResultSet generatedKeys = stmt.getGeneratedKeys()) {
                    if(generatedKeys.next()) {
                        int messageId = generatedKeys.getInt(1);
                        String value = String.valueOf(messageId);
                        MessageLog.MessageType messageType = chatId.startsWith("direct_") ?
                            MessageLog.MessageType.DIRECT : MessageLog.MessageType.GROUP;
                        MessageLog.MessageDirection direction = MessageLog.MessageDirection.SENT;
                        
                        messageTracker.track(
                            value, 
                            isEncrypted ? "[ENCRYPTED]" : finalContent, 
                            senderId,
                            username, 
                            chatId, 
                            messageType, 
                            direction
                        );

                        ChatCache chatCache = cacheService.getChatCache();
                        if(chatCache != null) {
                            chatCache.invalidateMessageCache(chatId);
                        }
                        return messageId;
                    }
                }
            }

            return -1;
        }
    }

    /**
     * Messages by User Id 
     */
    public List<Message> getMessagesByUserId(String userId) throws SQLException {
        String query = CommandQueryManager.GET_MESSAGES_BY_USER_ID.get();
        List<Message> messages = new ArrayList<>();

        try(
            Connection conn = getConnection();
            PreparedStatement stmt = conn.prepareStatement(query);
        ) {
            stmt.setString(1, userId);
            try(ResultSet rs = stmt.executeQuery()) {
                while(rs.next()) {
                    messages.add(mapMessageFromResultSet(rs));
                }
            }
        }

        return messages;
    }

    /**
     * Messages Page
     */
    public Map<String, Object> getMessagesPage(String chatId, int page, int pageSize) throws SQLException {
        List<Message> messages = getMessagesByChatId(chatId, page, pageSize);
        List<Message> systemMessages = serviceManager.getSystemMessageService().getMessagesByGroup(chatId);

        List<Message> allMessages = new ArrayList<>();
        allMessages.addAll(messages);
        allMessages.addAll(systemMessages);
        allMessages.sort(Comparator.comparing(Message::getCreatedAt));

        int totalCount = getMessageCountByChatId(chatId) + systemMessages.size();
        int totalPages = (int) Math.ceil((double) totalCount / pageSize);

        Map<String, Object> res = new HashMap<>();
        res.put("messages", allMessages);
        res.put("currentPage", page);
        res.put("pageSize", pageSize);
        res.put("totalMessages", totalCount);
        res.put("totalPages", totalPages);
        res.put("hasMore", page < totalPages - 1);
        res.put("systemMessagescount", systemMessages.size());
        return res;
    }

    /**
     * Get All Messages
     */
    public List<Message> getAllMessages() throws SQLException {
        String query = CommandQueryManager.GET_ALL_MESSAGES.get();
        List<Message> messages = new ArrayList<>();

        try(
            Connection conn = getConnection();
            PreparedStatement stmt = conn.prepareStatement(query);
            ResultSet rs = stmt.executeQuery();
        ) {
            while(rs.next()) {
                messages.add(mapMessageFromResultSet(rs));
            }
        }

        return messages;
    }

    /**
     * Get Last Messages By Chat Id 
     */
    public Map<String, Object> getLastMessagesByChatId(String chatId) throws SQLException {
        String query = CommandQueryManager.GET_LAST_MESSAGE_BY_CHAT_ID.get();
        try (
            Connection conn = getConnection();
            PreparedStatement stmt = conn.prepareStatement(query);
        ) {
            stmt.setString(1, chatId);
            try (ResultSet rs = stmt.executeQuery()) {
                if(rs.next()) {
                    Map<String, Object> lastMessage = new HashMap<>();
                    byte[] contentBytes = rs.getBytes("content");
                    lastMessage.put("contentBytes", contentBytes);
                    lastMessage.put("content", "[Encrypted]");
                    lastMessage.put("senderId", rs.getString("sender_id"));
                    lastMessage.put("timestamp", rs.getString("timestamp"));
                    return lastMessage;
                }
            }
        }
        return null;
    }

    /**
     * Save System Message
     */
    public int saveSystemMessage(String content,String messageType) throws SQLException {
        String query = CommandQueryManager.SAVE_MESSAGE.get();
        int keys = Statement.RETURN_GENERATED_KEYS;

        try(
            Connection conn = getConnection();
            PreparedStatement stmt = conn.prepareStatement(query, keys);
        ) {
            stmt.setString(1, content);
            stmt.setString(2, messageType);

            int affectedRows = stmt.executeUpdate();
            if(affectedRows > 0) {
                try(ResultSet generatedKeys = stmt.getGeneratedKeys()) {
                    if(generatedKeys.next()) {
                        return generatedKeys.getInt(1);
                    }
                }
            }

            return -1;
        }
    }

    /**
     * 
     * Message by Chat Id
     * 
     */
    public List<Message> getMessagesByChatId(String chatId, int page, int pageSize) throws SQLException {
        ChatCache chatCache = cacheService.getChatCache();
        if(chatCache != null) {
            List<Message> cachedMessages = cacheService.getChatCache().getCachedMessages(chatId, page);
            if(cachedMessages != null) {
                //System.out.println("Returning cached messages for chat " + chatId + " page " + page);
                return cachedMessages;
            }
        }

        String encriptionKey = chatId;
        if(!secureMessageService.hasActiveSession(encriptionKey)) {
            System.out.println("No active session");
        }
        
        String query = CommandQueryManager.GET_MESSAGES_BY_CHAT_ID.get();
        List<Message> messages = new ArrayList<>();

        try(
            Connection conn = getConnection();
            PreparedStatement stmt = conn.prepareStatement(query);
        ) {
            int offset = page * pageSize;
            stmt.setString(1, chatId);
            stmt.setInt(2, pageSize);
            stmt.setInt(3, offset);

            try(ResultSet rs = stmt.executeQuery()) {
                while(rs.next()) {
                    messages.add(mapMessageFromResultSet(rs));
                }
            }
        }

        if(chatCache != null) cacheService.getChatCache().cacheMessages(chatId, page, messages);
        return messages;
    }

    public List<Message> getAllMessagesByChatId() throws SQLException {
        String query = CommandQueryManager.GET_ALL_MESSAGES_BY_CHAT_ID.get();
        List<Message> messages = new ArrayList<>();

        try(
            Connection conn = getConnection();
            PreparedStatement stmt = conn.prepareStatement(query);
            ResultSet rs = stmt.executeQuery(); 
        ) {
            while(rs.next()) {
                messages.add(mapMessageFromResultSet(rs));
            }
        }

        return messages;
    }

    public int getMessageCountByChatId(String chatId) throws SQLException {
        String query = CommandQueryManager.GET_MESSAGE_COUNT_BY_CHAT_ID.get();
        try(
            Connection conn = getConnection();
            PreparedStatement stmt = conn.prepareStatement(query);
        ) {
            stmt.setString(1, chatId);
            try(ResultSet rs = stmt.executeQuery()) {
                if(rs.next()) {
                    return rs.getInt("count");
                }
            }
        }
        return 0;
    }

    /**
     * 
     * Recent Chats
     * 
     */
    public List<RecentChat> getRecentChats(String userId, int limit, int offset) throws SQLException {
        String query = CommandQueryManager.GET_RECENT_CHATS.get();
        List<RecentChat> recentChats = new ArrayList<>();
        int actualLimit = Math.max(1, limit);

        try(
            Connection conn = getConnection();
            PreparedStatement stmt = conn.prepareStatement(query)
        ) {
            stmt.setString(1, userId);
            stmt.setString(2, "%" + userId + "%");
            stmt.setInt(3, actualLimit); 
            stmt.setInt(4, offset);

            try(ResultSet rs = stmt.executeQuery()) {
                while(rs.next()) {
                    String chatId = rs.getString("chat_id");
                    String chatType = rs.getString("chat_type");

                    byte[] lastMessageBytes = rs.getBytes("last_message");
                    String lastMessage;
                    if(lastMessageBytes != null) {
                        String messageString = new String(lastMessageBytes);
                        if(messageString.startsWith("[ENCRYPTED]")) {
                            lastMessage = "[Encrypted Message]";
                        } else {
                            lastMessage = messageString;
                        }
                    } else {
                        lastMessage = "";
                    }
                    String lastSender = rs.getString("last_sender");
                    Timestamp lastMessageTime = rs.getTimestamp("last_message_time");

                    String chatName;
                    if("group".equals(chatType)) {
                        chatName = getGroupName(chatId);
                    } else {
                        chatName = getDirectChatName(chatId, userId);
                    }

                    RecentChat chat = new RecentChat();
                    chat.setChatId(chatId);
                    chat.setLastMessageTime(lastMessageTime);
                    chat.setLastMessage(lastMessage);
                    chat.setLastSender(lastSender);
                    chat.setChatType(chatType);
                    chat.setChatName(chatName);
                    recentChats.add(chat);
                }
            }
        }

        return recentChats;
    }

    public Map<String, Object> getRecentChatsPages(String userId, int page, int pageSize) throws SQLException {
        int offset = page * pageSize;
        List<RecentChat> chats = getRecentChats(userId, pageSize, offset);
        int totalChats = getRecentChatsCount(userId);
        int totalPages = (int) Math.ceil((double) totalChats / pageSize);

        Map<String, Object> res = new HashMap<>();
        res.put("chats", chats);
        res.put("currentPage", page);
        res.put("pageSize", pageSize);
        res.put("totalChats", totalChats);
        res.put("totalPages", totalPages);
        res.put("hasMore", page < totalPages - 1);
        return res;
    }

    public int getRecentChatsCount(String userId) throws SQLException {
        String query = CommandQueryManager.GET_RECENT_CHATS_COUNT.get();
        try(
            Connection conn = getConnection();
            PreparedStatement stmt = conn.prepareStatement(query)
        ) {
            stmt.setString(1, userId);
            stmt.setString(2, userId);
            try(ResultSet rs = stmt.executeQuery()) {
                if(rs.next()) {
                    return rs.getInt("total_chats");
                }
            }
        }
        return 0;
    }

    /**
     * 
     * Payload
     * 
     */
    public Map<String, Object> payload(
        String type, 
        Map<String, Object> payload,
        String chatId,
        String sessionId,
        String currentUserId
    ) { 
        Map<String, Object> message = new HashMap<>();
        message.put("username", payload.get("username"));
        message.put("content", payload.get("content"));
        message.put("senderId", currentUserId);
        message.put("chatId", chatId);
        message.put("userId", currentUserId);
        message.put("messageId", payload.get("messageId"));
        message.put("timestamp", payload.get("timestamp"));
        message.put("type", type);
        message.put("isDirect", "DIRECT".equalsIgnoreCase(type));
        message.put("isGroup", "GROUP".equalsIgnoreCase(type));
        message.put("isSystem", "SYSTEM".equalsIgnoreCase(type));
        message.put("isBroadcast", false);
                
        Map<String, Object> routingMetadata = new HashMap<>();
        routingMetadata.put("sessionId", sessionId);
        routingMetadata.put("userId", payload.get("userId"));
        routingMetadata.put("messageType", type + "_MESSAGE");
        routingMetadata.put("messageId", payload.get("messageId"));
        routingMetadata.put("isDirect", "DIRECT".equalsIgnoreCase(type));
        routingMetadata.put("isGroup", "GROUP".equalsIgnoreCase(type));
        routingMetadata.put("isBroadcast", false);
        routingMetadata.put("priority", "NORMAL");
        message.put("routingMetadata", routingMetadata);

        return message;
    }

    /**
     * 
     * Perspective
     * 
     */
    public MessagePerspectiveResult createSelfPerspective(
        MessagePerspectiveResult result,
        boolean isGroup,
        String displayUsername,
        String sessionId
    ) {
        result.setDirection("self");
        result.setPerpspectiveType("SELF_SENT");

        result.getRenderConfig().put("sessionSenderId", false);
        result.getRenderConfig().put("showUsername", false);
        result.getRenderConfig().put("displayUsername", sessionId);
        
        result.getMetadata().put("isCurrentUser", true);
        result.getMetadata().put("isGroup", isGroup);
        result.getMetadata().put("isDirect", !isGroup);
        result.getMetadata().put("isSystem", false);

        return result;
    }

    public MessagePerspectiveResult createOtherPerspective(
        MessagePerspectiveResult result,
        boolean isGroup,
        String displayUsername,
        String sessionId
    ) {
        result.setDirection("other");
        result.setPerpspectiveType(isGroup ? "GROUP_OTHER_USER" : "OTHER_USER");

        boolean shouldShowUsername = isGroup && displayUsername != null;
        result.getRenderConfig().put("showUsername", shouldShowUsername);
        result.getRenderConfig().put("displayUsername", displayUsername);
        result.getRenderConfig().put("displayUsername", sessionId);
        
        result.getMetadata().put("isCurrentUser", false);
        result.getMetadata().put("isGroup", isGroup);
        result.getMetadata().put("isDirect", !isGroup);
        result.getMetadata().put("isSystem", false);

        return result;
    }

    /**
     * 
     * Maps
     * 
     */
    public Message mapMessageFromResultSet(ResultSet rs) throws SQLException {
        Message message = new Message();
        message.setId(rs.getInt("id"));
        message.setChatId(rs.getString("chat_id"));
        message.setSenderId(rs.getString("sender_id"));

        byte[] contentBytes = rs.getBytes("content");
        message.setContentBytes(contentBytes);
        
        String content;
        if(isEncryptedData(contentBytes)) {
            content = "[ENCRYPTED]" + new String(contentBytes, StandardCharsets.UTF_8);;
        } else {
            content = new String(contentBytes, StandardCharsets.UTF_8);
        }
        message.setContent(content);
        
        message.setMessageType(rs.getString("message_type"));
        message.setCreatedAt(rs.getTimestamp("created_at"));
        message.setUsername(rs.getString("username"));
        return message;
    }

    private RecentChat mapRecentChatFromResultSet(ResultSet rs) throws SQLException {
        RecentChat chat = new RecentChat();
        chat.setChatId(rs.getString("chat_id"));
        chat.setLastMessageTime(rs.getTimestamp("last_message_time"));
        chat.setLastMessage(rs.getString("last_message"));
        chat.setLastSender(rs.getString("last_sender"));
        chat.setChatType(rs.getString("chat_type"));
        chat.setChatName(rs.getString("chat_name"));
        return chat;
    }

    /**
     * 
     * --- Methods with other DB Connections
     * 
     */
    private String getGroupName(String groupId) throws SQLException {
        String query = CommandQueryManager.GET_GROUP_NAME.get();
        DataSource db = dataSourceService.setDb("group_service");

        try(
            Connection conn = db.getConnection();
            PreparedStatement stmt = conn.prepareStatement(query)
        ) {
            stmt.setString(1, groupId);
            try(ResultSet rs = stmt.executeQuery()) {
                if(rs.next()) {
                    return rs.getString("name");
                }
            }
        }

        return "Group Chat*";
    }

    private String getDirectChatName(String chatId, String currentUserId) throws SQLException {
        String query = CommandQueryManager.GET_USERNAME.get();
        DataSource db = dataSourceService.setDb("user_service");

        try(
            Connection conn = db.getConnection();
            PreparedStatement stmt = conn.prepareStatement(query);
        ) {
            String otherUserId = extractOtherUserId(chatId, currentUserId);
            stmt.setString(1, otherUserId);

            try(ResultSet rs = stmt.executeQuery()) {
                if(rs.next()) {
                    return rs.getString("username");
                }
            }
        }

        return "User*";
    }

    private String extractOtherUserId(String chatId, String currentUserId) {
        if(chatId.startsWith("direct_")) {
            String[] parts = chatId.split("_");
            for(String part : parts) {
                if(!part.equals("direct") && !part.equals(currentUserId)) {
                    return part;
                }
            }
        }
        return chatId;
    }

    /**
     * 
     * Encryption
     * 
     */
    private boolean isEncryptedData(byte[] bytes) {
        if(bytes == null || bytes.length < 32) return false;
        if(bytes.length >= 32) return true;
        
        int nonPrintableCount = 0;
        for(int i = 0; i < Math.min(bytes.length, 50); i++) {
            byte b = bytes[i];
            if((b < 32 && b != 9 && b != 10 && b != 13) || b > 126) {
                nonPrintableCount++;
            }
        }
        return (nonPrintableCount / (double) Math.min(bytes.length, 50)) > 0.7;
    }

    private boolean isBytesEncrypted(byte[] bytes) {
        if(bytes == null || bytes.length < 10) return false;
        
        int nonPrintableCount = 0;
        for(int i = 0; i < Math.min(bytes.length, 20); i++) {
            byte b = bytes[i];
            if((b < 32 && b != 9 && b != 10 && b != 13) || b == 127) {
                nonPrintableCount++;
            }
        }
        return nonPrintableCount > 4;
    }

    public boolean initChatEncryption(String chatId, PreKeyBundle preKeyBundle) {
        try {
            String encriptionKey = chatId;
            return secureMessageService.startSession(encriptionKey, preKeyBundle);
        } catch(Exception err) {
            System.err.println("Failed to initialize chat encryption: " + err.getMessage());
            return false;
        }
    }

    public boolean hasChatEncryption(String chatId) {
        String encryptionKey = chatId;
        return secureMessageService.hasActiveSession(encryptionKey);
    }

    public PreKeyBundle getChatPreKeyBundle(String chatId) {
        return secureMessageService.getPreKeyBundle();
    }
}