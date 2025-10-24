package com.app.main.root.app._service;
import com.app.main.root.app._data.MessageContext;
import com.app.main.root.app._data.MessagePerspective;
import com.app.main.root.app._db.CommandQueryManager;
import com.app.main.root.app._types._Message;
import com.app.main.root.app._types._RecentChat;
import com.app.main.root.app._utils.FunctionalInterfaces;
import com.app.main.root.app.main._messages_config.MessageLog;
import com.app.main.root.app.main._messages_config.MessageTracker;
import org.springframework.context.annotation.Lazy;
import org.springframework.stereotype.Component;
import javax.sql.DataSource;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.sql.*;
import java.util.*;

@Component
public class MessageService {
    private final DataSource dataSource;
    private final ServiceManager serviceManager;
    private final MessageTracker messageTracker;
    private String ctx;

    public MessageService(
        DataSource dataSource, 
        @Lazy ServiceManager serviceManager,
        MessageTracker messageTracker
    ) {
        this.dataSource = dataSource;
        this.serviceManager = serviceManager;
        this.messageTracker = messageTracker;
    }

    public String setCtx(String data) {
        ctx = data;
        return data;
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
        ctx = content;
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
    public int saveSystemMessage(String content, String messageType) throws SQLException {
        ctx = content;
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

    public String resolve() {
        return ctx;
    }

    /*
    * Id 
    */
    private String generateId() {
        return "msg_" + System.currentTimeMillis() + "_" + UUID.randomUUID().toString().substring(0, 8);
    }

    /*
    * Create Message 
    */
    private MessageContext createMessage(
        String senderSessionId,
        String content,
        String chatId,
        String senderUserId,
        String senderUsername,
        String recipientUserId,
        boolean isDirect,
        Map<String, Object> data
    ) {
        MessageContext context = new MessageContext(
            senderSessionId,
            content,
            generateId(),
            chatId,
            senderUserId,
            senderUsername,
            isDirect,
            !isDirect,
            false,
            isDirect
        )
        .toMessagePerspective().withPerspective(recipientUserId)
        .withContextType(MessageContext.ContextType.REGULAR)
        .withContext("originalSender", senderUserId)
        .withContext("recipient", recipientUserId)
        .withContext("isDirectMessage", isDirect)
        .withAllContext(data);

        MessagePerspective perspective = context.toMessagePerspective();
        String displayUsername = perspective.isSelf() ? "" : senderUsername;
        return context.withContext("displayUsername", displayUsername);
    }

    /*
    * Send Message 
    */
    public void sendMessage(
        String senderSessionId,
        String content,
        String chatId,
        boolean isDirect,
        Map<String, Object> data,
        FunctionalInterfaces.Function1<
            MessageContext, Map<String, Object>
        > createPayloadFn,
        FunctionalInterfaces.TriConsumer<
            String, Map<String, Object>, String
        > deliverMessageFn
    ) {
        String senderUserId = serviceManager.getUserService().getUserIdBySession(senderSessionId);
        String senderUsername = (String) data.get("username");
        //if(!isDirect) recipientSessionIds.remove(senderSessionId);

        Set<String> recipientSessionIds = isDirect ?
            new HashSet<>(List.of((String) data.get("targetSessionId"))) :
            serviceManager.getGroupService().getGroupSessionIds(chatId);

        for(String recipientSessionId : recipientSessionIds) {
            String recipientUserId = serviceManager.getUserService().getUserIdBySession(recipientSessionId);
            MessageContext context = createMessage(
                senderSessionId, 
                content,  
                chatId, 
                senderUserId, 
                senderUsername, 
                recipientUserId, 
                isDirect,
                data
            );
            Map<String, Object> payload = (Map<String, Object>) createPayloadFn.apply(context);
            deliverMessageFn.accept(senderSessionId, payload, "MESSAGE");
        }

        MessageContext context = createMessage(
            senderSessionId, 
            content, 
            chatId, 
            senderUserId, 
            senderUsername, 
            senderUserId, 
            isDirect, 
            data
        );

        Map<String, Object> payload = (Map<String, Object>) createPayloadFn.apply(context);
        payload.put("isSelf", true);
        deliverMessageFn.accept(senderSessionId, payload, "MESSAGE");
        try {
            saveMessage(chatId, senderUserId, content, senderUsername);
        } catch(SQLException err) {
            System.err.println("Failed to save messages: " + err.getMessage());
        }
    }
}