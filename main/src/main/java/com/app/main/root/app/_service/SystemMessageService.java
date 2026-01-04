package com.app.main.root.app._service;
import com.app.main.root.app._data.CommandSystemMessageList;
import com.app.main.root.app._data.MessagePerspectiveDetector;
import com.app.main.root.app._data.MessagePerspectiveResult;
import com.app.main.root.app._db.CommandQueryManager;
import com.app.main.root.app._db.DataSourceService;
import com.app.main.root.app._types.Message;
import com.app.main.root.app.main.chat.messages.MessageLog;
import com.app.main.root.app.main.chat.messages.MessageTracker;

import org.springframework.context.annotation.Lazy;
import org.springframework.stereotype.Component;
import java.sql.Statement;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.*;


@Component
public class SystemMessageService {
    private final DataSourceService dataSourceService;
    private final MessageTracker messageTracker;
    private final ServiceManager serviceManager;
    private final MessagePerspectiveDetector messagePerspectiveDetector;

    public SystemMessageService(
        DataSourceService dataSourceService,
        @Lazy ServiceManager serviceManager,
        @Lazy MessagePerspectiveDetector messagePerspectiveDetector,
        MessageTracker messageTracker
    ) {
        this.dataSourceService = dataSourceService;
        this.serviceManager = serviceManager;
        this.messagePerspectiveDetector = messagePerspectiveDetector;
        this.messageTracker = messageTracker;
    }

    private Connection getConnection() throws SQLException {
        return dataSourceService.setDb("system-messages").getConnection();
    }

    /*
    * Save Message 
    */
    public int saveMessage(
        String groupId,
        String content,
        String messageType
    ) throws SQLException {
        String query = CommandQueryManager.SAVE_SYSTEM_MESSAGE.get();
        int keys = Statement.RETURN_GENERATED_KEYS;

        try (
            Connection conn = getConnection();
            PreparedStatement stmt = conn.prepareStatement(query, keys);
        ) {
            stmt.setString(1, groupId);
            stmt.setString(2, content);
            stmt.setString(3, messageType);

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

    /*
    * Messages By Group 
    */
    public List<Message> getMessagesByGroup(String groupId) throws SQLException {
        String query = CommandQueryManager.GET_SYSTEM_MESSAGES_BY_GROUP.get();
        List<Message> messages = new ArrayList<>();

        try(
            Connection conn = getConnection();
            PreparedStatement stmt = conn.prepareStatement(query);
        ) {
            stmt.setString(1, groupId);

            try(ResultSet rs = stmt.executeQuery()) {
                while(rs.next()) {
                    messages.add(mapMessagesFromResultSet(rs));
                }
            }
        }
        
        return messages;
    }

    /*
    * Map Messages ResultSet
    */
    private Message mapMessagesFromResultSet(ResultSet rs) throws SQLException {
        Message message = new Message();
        message.setId(rs.getInt("id"));
        message.setChatId(rs.getString("chat_id"));
        message.setSenderId("system");
        message.setContent(rs.getString("content"));
        message.setMessageType(rs.getString("message_type"));
        message.setCreatedAt(rs.getTimestamp("created_at"));
        message.setUsername(null);
        message.setSystem(true);
        return message;
    }

    /*
    * Get Template
    */
    private String getTemplate(String eventType) {
        try {
            CommandSystemMessageList message = CommandSystemMessageList.valueOf(eventType);
            return message.get();
        } catch(IllegalArgumentException err) {
            System.err.println("TEMPLATE ERR:" + err);
            return "System event ***";
        }
    }

    /*
    * Set Content
    */
    public String setContent(
        String template,
        Map<String, Object> data,
        String currentSessionId,
        String targetSessionId
    ) {
        String username = (String) data.get("username");
        String groupName = (String) data.get("groupName");
        String inviterUsername = (String) data.get("inviterUsername");
        boolean isInviterCurrentUser = messagePerspectiveDetector.isInviterCurrentUser(data, targetSessionId);

        String content = template;
        boolean isAboutCurrentUser = messagePerspectiveDetector.isAboutCurrentUser(data, targetSessionId);

        String finalUsername = username != null ? username : "Unknown";
        String finalInviterUsername = inviterUsername != null ? inviterUsername : "Unknown";

        if(isAboutCurrentUser) {
            content = content.replace("{username}", "You");
        } else {
            content = content.replace("{username}", finalUsername);
        }
        if(isInviterCurrentUser) {
            content = content.replace("{inviterUsername}", "You");
        } else {
            content = content.replace("{inviterUsername}", finalInviterUsername);
        }

        if(groupName != null) content = content.replace("{group}", groupName);
        return content;
    }

    /*
    * Create Message 
    */
    public Map<String, Object> createMessage(
        String eventType,
        Map<String, Object> data,
        String currentSessionId,
        String targetSessionId
    ) {
        long time = System.currentTimeMillis();
        String template = getTemplate(eventType);
        String content = setContent(
            template,
            data,
            currentSessionId,
            targetSessionId
        );

        Map<String, Object> systemMessage = new HashMap<>();
        systemMessage.put("type", "SYSTEM");
        systemMessage.put("messageType", eventType);
        systemMessage.put("event", eventType);
        systemMessage.put("content", content);
        systemMessage.put("timestamp", time);
        systemMessage.put("isSystem", true);
        systemMessage.put("sessionId", currentSessionId);
        systemMessage.put("targetSessionId", targetSessionId);
        systemMessage.put("originalData", data);
        systemMessage.put("isCurrentUser", systemMessage.get("isCurrentUser"));
        return systemMessage;
    }

    public Map<String, Object> createMessageWithPerspective(
        String eventType,
        Map<String, Object> data,
        String currentSessionId,
        String targetSessionId
    ) {
        Map<String, Object> message = createMessage(eventType, data, currentSessionId, targetSessionId);
        MessagePerspectiveResult perspective = messagePerspectiveDetector.detectPerspective(targetSessionId, message);
        message.put("_perspective", createPerspectiveMap(perspective));
        message.put("_metadata", createMetadata(perspective, data, currentSessionId));
        return message;
    }

    /*
    * Create and Save 
    */
    public Map<String, Object> createAndSaveMessage(
        String eventType,
        Map<String, Object> data,
        String currentSessionId,
        String targetSessionId,
        String groupId
    ) {
        try {
            String id = "sys_" + System.currentTimeMillis() + "_" + UUID.randomUUID().toString().substring(0, 8);
            Map<String, Object> message = createMessageWithPerspective(
                eventType, 
                data, 
                currentSessionId, 
                targetSessionId
            );
            int saveMessage = saveMessage(
                groupId,
                message.get("content").toString(),
                eventType
            );
            track(
                String.valueOf(saveMessage),
                message.get("content").toString(),
                groupId,
                eventType
            );
            message.put("messageId", id);
            message.put("id", saveMessage);

            return message;
        } catch(SQLException err) {
            System.err.println("Failed to save system message" + err.getMessage());
            return createMessageWithPerspective(
                eventType, 
                data, 
                currentSessionId, 
                targetSessionId
            );
        }
    }

    /*
    * Track 
    */
    public void track(
        String messageId,
        String content,
        String groupId,
        String eventType
    ) {
        messageTracker.track(
            messageId,
            content,
            "system",
            "System",
            groupId,
            MessageLog.MessageType.SYSTEM,
            MessageLog.MessageDirection.RECEIVED
        );
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
        message.put("chatId", chatId);
        message.put("groupId", chatId);
        message.put("messageId", payload.get("messageId"));
        message.put("timestamp", payload.get("timestamp"));
        message.put("isCurrentUser", payload.get("isCurrentUser"));
        message.put("type", "SYSTEM_MESSAGE");
        message.put("event", payload.get("eventType"));
        message.put("isDirect", false);
        message.put("isGroup", true);
        message.put("isSystem", true);
        message.put("isBroadcast", false);
        
        return message;
    }

    /*
    **
    ***
    *** Perpspective
    ***
    **
    */
    private Map<String, Object> createPerspectiveMap(MessagePerspectiveResult result) {
        Map<String, Object> map = new HashMap<>();
        map.put("direction", result.getDirection());
        map.put("perspectiveType", result.getPerpspectiveType());
        map.put("renderConfig", result.getRenderConfig());
        map.put("metadata", result.getMetadata());
        return map;
    }

    private Map<String, Object> createMetadata(
        MessagePerspectiveResult result,
        Map<String, Object> data,
        String sessionId
    ) {
        boolean isAboutCurrentUser = messagePerspectiveDetector.isAboutCurrentUser(data, sessionId);
        Map<String, Object> metadata = new HashMap<>();
        metadata.put("direction", result.getDirection());
        metadata.put("perspectiveType", result.getPerpspectiveType());
        metadata.put("isSystem", true);
        metadata.put("isAboutCurrentUser", isAboutCurrentUser);
        return metadata;
    }

    public MessagePerspectiveResult createPerspective(
        MessagePerspectiveResult result,
        Map<String, Object> data,
        String sessionId
    ) {
        boolean isAboutCurrentUser = messagePerspectiveDetector.isAboutCurrentUser(data, sessionId);
        result.setDirection("system");
        result.setPerpspectiveType("SYSTEM_MESSAGE");

        result.getRenderConfig().put("showUsername", false);
        result.getRenderConfig().put("displayUsername", null);
        result.getRenderConfig().put("showAvatar", false);
        result.getRenderConfig().put("alignment", "center");
        result.getRenderConfig().put("componentType", "system");
        result.getRenderConfig().put("isAboutCurrentUser", isAboutCurrentUser);

        result.getMetadata().put("isCurrentUser", false);
        result.getMetadata().put("isGroup", false);
        result.getMetadata().put("isDirect", false);
        result.getMetadata().put("isSystem", true);
        result.getMetadata().put("isAboutCurrentUser", isAboutCurrentUser);

        return result;
    }
}