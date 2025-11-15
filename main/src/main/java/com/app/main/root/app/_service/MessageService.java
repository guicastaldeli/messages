package com.app.main.root.app._service;
import com.app.main.root.app._data.MessagePerspectiveResult;
import com.app.main.root.app._db.CommandQueryManager;
import com.app.main.root.app._db.DataSourceService;
import com.app.main.root.app._types._Message;
import com.app.main.root.app._types._RecentChat;
import com.app.main.root.app.main._messages_config.MessageLog;
import com.app.main.root.app.main._messages_config.MessageTracker;
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
import java.util.Arrays;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.nio.charset.StandardCharsets;
import java.sql.*;

@Component
public class MessageService {
    private final UserController userController;
    private final DataSourceService dataSourceService;
    private final ServiceManager serviceManager;
    private final MessageTracker messageTracker;
    private final MessageAnalyzer messageAnalyzer;
    private final MessagePerspectiveDetector perspectiveDetector;
    @Autowired @Lazy private SecureMessageService secureMessageService;

    public MessageService(
        DataSourceService dataSourceService, 
        @Lazy ServiceManager serviceManager,
        MessageTracker messageTracker,
        MessageAnalyzer messageAnalyzer,
        MessagePerspectiveDetector messagePerspectiveDetector, 
        UserController userController
    ) {
        this.dataSourceService = dataSourceService;
        this.serviceManager = serviceManager;
        this.messageTracker = messageTracker;
        this.messageAnalyzer = messageAnalyzer;
        this.perspectiveDetector = messagePerspectiveDetector;
        this.userController = userController;
    }

    private Connection getConnection() throws SQLException {
        return dataSourceService.setDb("message").getConnection();
    }

    /*
    * Save Message Database 
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
            boolean isEncrypted = false;
            String finalContent = content;

            try {
                String encryptionKey = chatId;
                if(secureMessageService.hasActiveSession(encryptionKey)) {
                    messageContent = secureMessageService.encryptMessage(encryptionKey, content);
                    isEncrypted = true;
                    finalContent = "[ENCRYPTED]";
                } else {
                    messageContent = content.getBytes();
                    finalContent = content;
                }
            } catch(Exception err) {
                System.err.println("Encryption failed, using plainText" + err.getMessage());
                messageContent = content.getBytes();
                finalContent = content;
            }
            if(isEncrypted) {
                byte[] marker = "[ENCRYPTED]".getBytes();
                byte[] combined = new byte[marker.length + messageContent.length];
                System.arraycopy(marker, 0, combined, 0, marker.length);
                System.arraycopy(messageContent, 0, combined, marker.length, messageContent.length);
                messageContent = combined;
            }

            stmt.setString(1, chatId);
            stmt.setString(2, senderId);
            stmt.setBytes(3, messageContent);
            stmt.setString(4, fType);
            stmt.setString(5, username);

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
                            finalContent, 
                            senderId,
                            username, 
                            chatId, 
                            messageType, 
                            direction
                        );

                        return messageId;
                    }

                }
            }

            return -1;
        }
    }

    /*
    **
    *** Message by Chat Id
    ** 
    */
    public List<_Message> getMessagesByChatId(String chatId, int page, int pageSize) throws SQLException {
        String encriptionKey = chatId;
        if(!secureMessageService.hasActiveSession(encriptionKey)) {
            System.out.println("No active session");
        }
        
        String query = CommandQueryManager.GET_MESSAGES_BY_CHAT_ID.get();
        List<_Message> messages = new ArrayList<>();

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

        return messages;
    }

    public List<_Message> getAllMessagesByChatId() throws SQLException {
        String query = CommandQueryManager.GET_ALL_MESSAGES_BY_CHAT_ID.get();
        List<_Message> messages = new ArrayList<>();

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

    /*
    **
    *** Recent Chats
    ** 
    */
    public List<_RecentChat> getRecentChats(String userId, int limit, int offset) throws SQLException {
        String query = CommandQueryManager.GET_RECENT_CHATS.get();
        List<_RecentChat> recentChats = new ArrayList<>();
        int actualLimit = Math.max(1, limit);

        try(
            Connection conn = getConnection();
            PreparedStatement stmt = conn.prepareStatement(query)
        ) {
            stmt.setString(1, userId);
            stmt.setString(2, userId);
            stmt.setString(3, "%" + userId + "%");
            stmt.setInt(4, actualLimit);
            stmt.setInt(5, offset);

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

                    _RecentChat chat = new _RecentChat();
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
        List<_RecentChat> chats = getRecentChats(userId, pageSize, offset);
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

    /*
    * Messages by User Id 
    */
    public List<_Message> getMessagesByUserId(String userId) throws SQLException {
        String query = CommandQueryManager.GET_MESSAGES_BY_USER_ID.get();
        List<_Message> messages = new ArrayList<>();

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

    /*
    * Messages Pages 
    */
    public Map<String, Object> getMessagesPage(String chatId, int page, int pageSize) throws SQLException {
        List<_Message> messages = getMessagesByChatId(chatId, page, pageSize);
        int totalCount = getMessageCountByChatId(chatId);
        int totalPages = (int) Math.ceil((double) totalCount / pageSize);

        Map<String, Object> res = new HashMap<>();
        res.put("messages", messages);
        res.put("currentPage", page);
        res.put("pageSize", pageSize);
        res.put("totalMessages", totalCount);
        res.put("totalPages", totalPages);
        res.put("hasMore", page < totalPages - 1);
        return res;
    }

    /*
    * Get All Messages 
    */
    public List<_Message> getAllMessages() throws SQLException {
        String query = CommandQueryManager.GET_ALL_MESSAGES.get();
        List<_Message> messages = new ArrayList<>();

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

    /*
    **
    *** Payload
    **  
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

    /*
    **
    ***
    *** Perspective
    ***
    **
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

    /*
    * Get Last Message By Chat Id 
    */
    public Map<String, Object> getLastMessagesByChatId(String chatId) throws SQLException {
        String query = CommandQueryManager.GET_LAST_MESSAGE_BY_CHAT_ID.get();
        try(
            Connection conn = getConnection();
            PreparedStatement stmt = conn.prepareStatement(query);
        ) {
            stmt.setString(1, chatId);
            try(ResultSet rs = stmt.executeQuery()) {
                if(rs.next()) {
                    Map<String, Object> lastMessage = new HashMap<>();

                    byte[] contentBytes = rs.getBytes("content");
                    String content;
                    if(contentBytes != null) {
                        String contentString = new String(contentBytes);
                        if(contentString.startsWith("[ENCRYPTED]")) {
                            content = "[Encrypted]";
                        } else {
                            content = contentString;
                        }
                    } else {
                        content = "";
                    }
                    lastMessage.put("content", content);

                    lastMessage.put("senderId", rs.getString("sender_id"));
                    lastMessage.put("timestamp", rs.getString("timestamp"));
                    return lastMessage;
                }
            }
        }
        return null;
    }

    /*
    **
    ***
    *** Maps
    ***
    **
    */
    public _Message mapMessageFromResultSet(ResultSet rs) throws SQLException {
        _Message message = new _Message();
        message.setId(rs.getInt("id"));
        message.setChatId(rs.getString("chat_id"));
        message.setSenderId(rs.getString("sender_id"));

        byte[] contentBytes = rs.getBytes("content");
        String content;
        if(contentBytes != null) {
            String contentString = new String(contentBytes, StandardCharsets.UTF_8);
            if(contentString.startsWith("[ENCRYPTED]")) {
                try {
                    String chatId = rs.getString("chat_id");
                    String encryptionKey = chatId;
                    if(secureMessageService.hasActiveSession(encryptionKey)) {
                        byte[] encryptedContent = Arrays.copyOfRange(
                            contentBytes,
                            "[ENCRYPTED]".getBytes().length,
                            contentBytes.length
                        );
                        content = secureMessageService.decryptMessage(encryptionKey, encryptedContent);
                    } else {
                        content = "[Encrypted Message]";
                    }
                } catch(Exception err) {
                    System.err.println(err.getMessage());
                    content = "[Encrypted Message - failed]";
                }
            } else {
                content = contentString;
            }
        } else {
            content = "";
        }
        message.setContent(content);

        message.setMessageType(rs.getString("message_type"));
        message.setCreatedAt(rs.getTimestamp("created_at"));
        message.setUsername(rs.getString("username"));
        return message;
    }

    private _RecentChat mapRecentChatFromResultSet(ResultSet rs) throws SQLException {
        _RecentChat chat = new _RecentChat();
        chat.setChatId(rs.getString("chat_id"));
        chat.setLastMessageTime(rs.getTimestamp("last_message_time"));
        chat.setLastMessage(rs.getString("last_message"));
        chat.setLastSender(rs.getString("last_sender"));
        chat.setChatType(rs.getString("chat_type"));
        chat.setChatName(rs.getString("chat_name"));
        return chat;
    }

    /*
    **
    *** Save System Message
    ** 
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

    /* * * * *
    * ___ Methods with other DB Connections ___
    */
    private String getGroupName(String groupId) throws SQLException {
        String query = CommandQueryManager.GET_GROUP_NAME.get();
        DataSource db = dataSourceService.setDb("group");

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
        DataSource db = dataSourceService.setDb("user");

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

    /*
    **
    ***
    *** Encryption
    ***
    **
    */
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