package com.app.main.root.app.main.chat.messages;
import com.app.main.root.app._db.CommandQueryManager;
import com.app.main.root.app._db.DataSourceService;
import com.app.main.root.app.main.chat.messages.MessageLog.*;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Lazy;
import org.springframework.stereotype.Component;
import java.util.concurrent.CopyOnWriteArrayList;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.text.SimpleDateFormat;
import java.util.*;

@Component
public class MessageTracker {
    private static MessageTracker instance;
    @Lazy @Autowired private DataSourceService dataSourceService;
    private final List<MessageLog> logs = new CopyOnWriteArrayList<>();
    private final int maxMessages = 5000;

    private Connection getConnection() throws SQLException {
        return dataSourceService.setDb("message").getConnection();
    }

    public void track(
        String messageId,
        String content,
        String senderId,
        String username,
        String chatId,
        MessageType messageType,
        MessageDirection direction
    ) {
        try {
            Date timetamp = new Date();
    
            MessageLog messageLog = new MessageLog(
                messageId,
                content,
                senderId,
                username,
                chatId,
                messageType,
                direction,
                timetamp
            );

            logs.add(messageLog);
            if(logs.size() > maxMessages) {
                synchronized(logs) {
                    if(logs.size() > maxMessages) {
                        int excess = logs.size() - maxMessages;
                        logs.subList(0, excess).clear();
                    }
                }
            }
    
            //logMessageToConsole(messageLog);
        } catch(Exception err) {
            throw new RuntimeException("Failed to save message to db!", err);
        }
    }

    /*
    * Count
    */
    public int getMessageCount() throws SQLException {
        String query = CommandQueryManager.TOTAL_MESSAGES.get();

        try(
            Connection conn = getConnection();
            PreparedStatement stmt = conn.prepareStatement(query);
            ResultSet rs = stmt.executeQuery();
        ) {
            if(rs.next()) {
                return rs.getInt("count");
            }
        }

        return 0;
    }

    /*
    * Clear Messages 
    */
    public void clearMessages() throws SQLException {
        String query = CommandQueryManager.CLEAR_MESSAGES.get();

        try(
            Connection conn = getConnection();
            PreparedStatement stmt = conn.prepareStatement(query);
        ) {
            stmt.executeUpdate();
        }

        logs.clear();
    }

    /*
    * Stats 
    */
    public Map<String, Long> getMessageStats() throws SQLException {
        Map<String, Long> stats = new HashMap<>();

        String totalCount = CommandQueryManager.TOTAL_MESSAGES.get();
        String directCount = CommandQueryManager.TOTAL_MESSAGES_DIRECT.get();
        String groupCount = CommandQueryManager.TOTAL_MESSAGES_GROUP.get();

        stats.put("total", getCountFromQuery(totalCount));
        stats.put("direct", getCountFromQuery(directCount));
        stats.put("group", getCountFromQuery(groupCount));
        return stats;
    }

    private long getCountFromQuery(String query) throws SQLException {
        try(
            Connection conn = getConnection();
            PreparedStatement stmt = conn.prepareStatement(query);
            ResultSet rs = stmt.executeQuery();
        ) {
            if(rs.next()) {
                return rs.getLong("count");
            }
        }
        return 0;
    }

    /**
     * Log to Console
     */
    private void logMessageToConsole(MessageLog log) {
        String timestamp = new SimpleDateFormat("HH:mm:ss").format(log.getTimestamp());
        String direction = log.getDirection() == MessageDirection.SENT ? "SENT" : "RECEIVED";
        String type = log.getMessageType() == MessageType.DIRECT ? "DIRECT" : "GROUP";
        String username = log.getUsername();
        String chatId = log.getChatId();

        System.out.printf(
            direction, type, username, chatId, timestamp
        );
    }
}
