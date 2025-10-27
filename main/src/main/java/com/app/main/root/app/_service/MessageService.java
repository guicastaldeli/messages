package com.app.main.root.app._service;
import com.app.main.root.app._data.MessagePerspectiveResult;
import com.app.main.root.app._db.CommandQueryManager;
import com.app.main.root.app._types._Message;
import com.app.main.root.app._types._RecentChat;
import com.app.main.root.app.main._messages_config.MessageLog;
import com.app.main.root.app.main._messages_config.MessageTracker;
import com.app.main.root.app._data.MessageAnalyzer;
import com.app.main.root.app._data.MessagePerspectiveDetector;
import org.springframework.context.annotation.Lazy;
import org.springframework.stereotype.Component;
import javax.sql.DataSource;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.sql.*;

@Component
public class MessageService {
    private final DataSource dataSource;
    private final ServiceManager serviceManager;
    private final MessageTracker messageTracker;
    private final MessageAnalyzer messageAnalyzer;
    private final MessagePerspectiveDetector perspectiveDetector;

    public MessageService(
        DataSource dataSource, 
        @Lazy ServiceManager serviceManager,
        MessageTracker messageTracker,
        MessageAnalyzer messageAnalyzer,
        MessagePerspectiveDetector messagePerspectiveDetector
    ) {
        this.dataSource = dataSource;
        this.serviceManager = serviceManager;
        this.messageTracker = messageTracker;
        this.messageAnalyzer = messageAnalyzer;
        this.perspectiveDetector = messagePerspectiveDetector;
    }

    /*
    * Save Message Database 
    */
    public int saveMessage(
        String chatId,
        String senderId,
        String content,
        String type
    ) throws SQLException {
        String query = CommandQueryManager.SAVE_MESSAGE.get();

        try(
            Connection conn = dataSource.getConnection();
            PreparedStatement stmt = conn.prepareStatement(query, Statement.RETURN_GENERATED_KEYS)
        ) {
            String fType = type != null ? type : "text";

            stmt.setString(1, chatId);
            stmt.setString(2, senderId);
            stmt.setString(3, content);
            stmt.setString(4, fType);

            int affectedRows = stmt.executeUpdate();
            if(affectedRows > 0) {
                try(ResultSet generatedKeys = stmt.getGeneratedKeys()) {
                    if(generatedKeys.next()) {
                        return generatedKeys.getInt(1);
                    }
                    String value = String.valueOf(generatedKeys.getInt(1));
                    MessageLog.MessageType messageType = chatId.startsWith("direct_") ?
                        MessageLog.MessageType.DIRECT : MessageLog.MessageType.GROUP;
                    MessageLog.MessageDirection direction = MessageLog.MessageDirection.SENT;
                    
                    messageTracker.track(
                        value, 
                        content, 
                        senderId, 
                        "username", 
                        chatId, 
                        messageType, 
                        direction
                    );
                }
            }

            return -1;
        }
    }

    /*
    * Save System Message 
    */
    public int saveSystemMessage(String content,String messageType) throws SQLException {
        String query = CommandQueryManager.SAVE_MESSAGE.get();

        try(
            Connection conn = dataSource.getConnection();
            PreparedStatement stmt = conn.prepareStatement(query, Statement.RETURN_GENERATED_KEYS);
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

    public List<_Message> getMessagesByChat(String chatId) throws SQLException {
        String query = CommandQueryManager.GET_MESSAGES_BY_CHAT.get();
        List<_Message> messages = new ArrayList<>();

        try(
            Connection conn = dataSource.getConnection();
            PreparedStatement stmt = conn.prepareStatement(query)
        ) {
            stmt.setString(1, chatId);

            try(ResultSet rs = stmt.executeQuery()) {
                while(rs.next()) {
                    messages.add(mapMessageFromResultSet(rs));
                }
            }
        }

        return messages;
    }

    public List<_Message> getMessagesByChatId(String chatId, int limit) throws SQLException {
        String query = CommandQueryManager.GET_MESSAGES_BY_CHAT_WITH_LIMIT.get();
        List<_Message> messages = new ArrayList<>();

        try(
            Connection conn = dataSource.getConnection();
            PreparedStatement stmt = conn.prepareStatement(query)
        ) {
            stmt.setString(1, chatId);
            stmt.setInt(2, limit);

            try(ResultSet rs = stmt.executeQuery()) {
                while(rs.next()) {
                    messages.add(mapMessageFromResultSet(rs));
                }
            }
        }

        return messages;
    }

    public List<_RecentChat> getRecentChats(String userId, int limit) throws SQLException {
        String query = CommandQueryManager.GET_RECENT_CHATS.get();
        List<_RecentChat> recentChats = new ArrayList<>();

        try(
            Connection conn = dataSource.getConnection();
            PreparedStatement stmt = conn.prepareStatement(query)
        ) {
            stmt.setString(1, userId);
            stmt.setString(2, userId);
            stmt.setString(3, userId);
            stmt.setInt(4, limit);

            try(ResultSet rs = stmt.executeQuery()) {
                while(rs.next()) {
                    recentChats.add(mapRecentChatFromResultSet(rs));
                }
            }
        }

        return recentChats;
    }

    public List<_Message> getRecentMessages(String chatId, int limit) throws SQLException {
        String query = CommandQueryManager.GET_RECENT_MESSAGES.get();
        List<_Message> messages = new ArrayList<>();

        try(
            Connection conn = dataSource.getConnection();
            PreparedStatement stmt = conn.prepareStatement(query)
        ) {
            stmt.setString(1, chatId);
            stmt.setInt(2, limit);

            try(ResultSet rs = stmt.executeQuery()) {
                while(rs.next()) {
                    messages.add(mapMessageFromResultSet(rs));
                }
            }
        }

        List<_Message> reversed = new ArrayList<>();
        for(int i = messages.size() - 1; i >= 0; i--) reversed.add(messages.get(i));
        return reversed;
    }

    /*
    * Payload 
    */
    public Map<String, Object> payload(
        String type, 
        Map<String, Object> payload,
        String chatId,
        String sessionId
    ) { 
        Map<String, Object> message = new HashMap<>();
        message.put("username", payload.get("username"));
        message.put("content", payload.get("content"));
        message.put("senderId", payload.get("senderId"));
        message.put("senderSessionId", payload.get("senderSessionId"));
        message.put("chatId", chatId);
        message.put("userId", chatId);
        message.put("messageId", payload.get("messageId"));
        message.put("timestamp", payload.get("timestamp"));
        message.put("type", type);
        message.put("isDirect", false);
        message.put("isGroup", true);
        message.put("isSystem", false);
        message.put("isBroadcast", false);
                
        Map<String, Object> routingMetadata = new HashMap<>();
        routingMetadata.put("sessionId", sessionId);
        routingMetadata.put("messageType", "GROUP_MESSAGE");
        routingMetadata.put("messageId", payload.get("messageId"));
        routingMetadata.put("isDirect", false);
        routingMetadata.put("isGroup", true);
        routingMetadata.put("isBroadcast", false);
        routingMetadata.put("priority", "NORMAL");
        message.put("routingMetadata", routingMetadata);

        MessagePerspectiveResult perspectiveData = perspectiveDetector.detectPerspective(sessionId, message);
        Map<String, Object> perspective = new HashMap<>();
        perspective.put("direction", perspectiveData.getDirection());
        perspective.put("perspectiveType", perspectiveData.getPerpspectiveType());
        perspective.put("showUsername", perspectiveData.getRenderConfig().get("showUsername"));
        perspective.put("displayUsername", perspectiveData.getRenderConfig().get("displayUsername"));
        perspective.put("isCurrentUser", perspectiveData.getMetadata().get("isCurrentUser"));
        perspective.put("isDirect", perspectiveData.getMetadata().get("isDirect"));
        perspective.put("isGroup", perspectiveData.getMetadata().get("isGroup"));
        perspective.put("isSystem", perspectiveData.getMetadata().get("isSystem"));
        message.put("_perspective", perspective);

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
        String displayUsername
    ) {
        result.setDirection("self");
        result.setPerpspectiveType("SELF_SENT");

        result.getRenderConfig().put("showUsername", false);
        result.getRenderConfig().put("displayUsername", null);
        
        result.getMetadata().put("isCurrentUser", true);
        result.getMetadata().put("isGroup", isGroup);
        result.getMetadata().put("isDirect", !isGroup);
        result.getMetadata().put("isSystem", false);

        return result;
    }

    public MessagePerspectiveResult createOtherPerspective(
        MessagePerspectiveResult result,
        boolean isGroup,
        String displayUsername
    ) {
        result.setDirection("other");
        result.setPerpspectiveType(isGroup ? "GROUP_OTHER_USER" : "OTHER_USER");

        boolean shouldShowUSername = isGroup && displayUsername != null;
        result.getRenderConfig().put("showUsername", shouldShowUSername);
        result.getRenderConfig().put("displayUsername", displayUsername);
        
        result.getMetadata().put("isCurrentUser", false);
        result.getMetadata().put("isGroup", isGroup);
        result.getMetadata().put("isDirect", !isGroup);
        result.getMetadata().put("isSystem", false);

        return result;
    }

    /*
    **
    ***
    *** Maps
    ***
    **
    */
    private _Message mapMessageFromResultSet(ResultSet rs) throws SQLException {
        _Message message = new _Message();
        message.setId(rs.getInt("id"));
        message.setChatId(rs.getString("chat_id"));
        message.setSenderId(rs.getString("sender_id"));
        message.setContent(rs.getString("content"));
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
}