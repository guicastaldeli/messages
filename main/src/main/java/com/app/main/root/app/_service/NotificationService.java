package com.app.main.root.app._service;
import com.app.main.root.app._data.SocketMethods;
import com.app.main.root.app._db.CommandQueryManager;
import com.app.main.root.app._db.DataSourceService;
import org.springframework.stereotype.Service;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Types;
import java.util.*;

@Service
public class NotificationService {
    private final SocketMethods socketMethods;
    private final DataSourceService dataSourceService;
    private final ServiceManager serviceManager;

    public NotificationService(
        DataSourceService dataSourceService, 
        ServiceManager serviceManager, 
        SocketMethods socketMethods
    ) {
        this.dataSourceService = dataSourceService;
        this.serviceManager = serviceManager;
        this.socketMethods = socketMethods;
    }

    private Connection getConnection() throws SQLException {
        return dataSourceService.setDb("notification_service").getConnection();
    }

    /**
     * Save Notification
     */
    public void saveNotification(Map<String, Object> data) throws SQLException {
        String query = CommandQueryManager.SAVE_NOTIFICATION.get();
        try(
            Connection conn = getConnection();
            PreparedStatement stmt = conn.prepareStatement(query)
        ) {
            stmt.setString(1, (String) data.get("id"));
            stmt.setString(2, (String) data.get("userId"));
            stmt.setString(3, (String) data.get("type"));
            stmt.setString(4, (String) data.get("title"));
            stmt.setString(5, (String) data.get("message"));
            stmt.setString(6, (String) data.get("chatId"));
            stmt.setString(7, (String) data.get("senderId"));
            stmt.setString(8, (String) data.get("senderName"));
            stmt.setBoolean(9, (Boolean) data.getOrDefault("isRead", false));
            stmt.setString(10, (String) data.getOrDefault("priority", "NORMAL"));
            Object metadata = data.get("metadata");
            if(metadata != null) {
                stmt.setString(11, metadata.toString());
            } else {
                stmt.setNull(11, Types.VARCHAR);
            }

            stmt.executeUpdate();
        }
    }

    /**
     * Get User Notification
     */
    public List<Map<String, Object>> getUserNotification(String userId) throws SQLException {
        String query = CommandQueryManager.GET_USER_NOTIFICATIONS.get();
        List<Map<String, Object>> dataMap = new ArrayList<>();

        try(
            Connection conn = getConnection();
            PreparedStatement stmt = conn.prepareStatement(query)
        ) {
            stmt.setString(1, userId);
            ResultSet rs = stmt.executeQuery();
            while(rs.next()) {
                Map<String, Object> data = new HashMap<>();
                data.put("id", rs.getString("id"));
                data.put("userId", rs.getString("user_id"));
                data.put("type", rs.getString("type"));
                data.put("title", rs.getString("title"));
                data.put("message", rs.getString("message"));
                data.put("chatId", rs.getString("chat_id"));
                data.put("senderId", rs.getString("sender_id"));
                data.put("senderName", rs.getString("sender_name"));
                data.put("isRead", rs.getString("is_read"));
                data.put("priority", rs.getString("priority"));
                data.put("createdAt", rs.getString("created_at"));
                data.put("metadata", rs.getString("metadata"));
                dataMap.add(data);
            }
        }

        return dataMap;
    }

    /**
     * Mark As Read
     */
    public void markAsRead(String notificationid) throws SQLException {
        String query = CommandQueryManager.MARK_NOTIFICATION_AS_READ.get();
        try(
            Connection conn = getConnection();
            PreparedStatement stmt = conn.prepareStatement(query);
        ) {
            stmt.setString(1, notificationid);
            stmt.executeUpdate();
        }
    }

    public void markAllAsRead(String userId) throws SQLException {
        String query = CommandQueryManager.MARK_ALL_AS_READ.get();
        try(
            Connection conn = getConnection();
            PreparedStatement stmt = conn.prepareStatement(query);
        ) {
            stmt.setString(1, userId);
            stmt.executeUpdate();
        }
    }

    /**
     * Delete Notification
     */
    public void deleteNotification(String notificationId) throws SQLException {
        String query = CommandQueryManager.DELETE_NOTIFICATION.get();
        try(
            Connection conn = getConnection();
            PreparedStatement stmt = conn.prepareStatement(query)
        ) {
            stmt.setString(1, notificationId);
            stmt.executeUpdate();
        }
    }

    /**
     * Get Unread Count
     */
    public int getUnreadCount(String userId) throws SQLException {
        String query = CommandQueryManager.GET_UNREAD_COUNT.get();
        try(
            Connection conn = getConnection();
            PreparedStatement stmt = conn.prepareStatement(query);
        ) {
            stmt.setString(1, userId);
            ResultSet rs = stmt.executeQuery();
            if(rs.next()) return rs.getInt(1);
        }
        return 0;
    }

    /**
     * Send Notification
     */
    public void sendNotification(String userId, Map<String, Object> data) {
        try {
            String userSession = serviceManager.getUserService().getSessionByUserId(userId);
            if(userSession != null) {
                Map<String, Object> event = new HashMap<>();
                event.put("type", "NOTIFICATION");
                event.put("notification", data);
                event.put("timestamp", System.currentTimeMillis());
                
                socketMethods.send(userSession, "/user/queue/notifications", event);
            }
        } catch(Exception err) {
            System.err.println("Failed to send notification to user " + userId + ": " + err.getMessage());
        }
    }
}
