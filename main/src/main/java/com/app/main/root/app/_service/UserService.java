package com.app.main.root.app._service;
import com.app.main.root.app._types._User;
import com.app.main.root.app.EventTracker;
import com.app.main.root.app.EventLog.EventDirection;
import com.app.main.root.app._db.CommandQueryManager;
import com.app.main.root.app._server.RouteContext;
import com.app.main.root.app._server.ConnectionTracker;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import java.util.concurrent.ConcurrentHashMap;
import org.springframework.stereotype.Component;
import javax.sql.DataSource;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.sql.*;

@Component
public class UserService {
    private final DataSource dataSource;
    private final EventTracker eventTracker;
    private final ConnectionTracker connectionTracker;
    private final SimpMessagingTemplate messagingTemplate;
    public final Map<String, String> userToSessionMap = new ConcurrentHashMap<>();
    private final Map<String, String> sessionToUserMap = new ConcurrentHashMap<>();

    public UserService(
        DataSource dataSource,
        EventTracker eventTracker,
        ConnectionTracker connectionTracker,
        SimpMessagingTemplate messagingTemplate
    ) {
        this.dataSource = dataSource;
        this.eventTracker = eventTracker;
        this.connectionTracker = connectionTracker;
        this.messagingTemplate = messagingTemplate;
    }

    public void addUser(String id, String username, String sessionId) throws SQLException {
        String query = CommandQueryManager.ADD_USER.get();

        try(
            Connection conn = dataSource.getConnection();
            PreparedStatement stmt = conn.prepareStatement(query)
        ) {
            stmt.setString(1, id);
            stmt.setString(2, username);
            stmt.setString(3, sessionId);
            stmt.executeUpdate();
        }
    }

    public _User getUserById(String id) throws SQLException {
        String query = CommandQueryManager.GET_USER_BY_ID.get();

        try(
            Connection conn = dataSource.getConnection();
            PreparedStatement stmt = conn.prepareStatement(query)
        ) {
            stmt.setString(1, id);

            try(ResultSet rs = stmt.executeQuery()) {
                if(rs.next()) {
                    return mapUserFromResultSet(rs);
                }
            }
        }

        return null;
    }

    public _User getUserByUsername(String username) throws SQLException {
        String query = CommandQueryManager.GET_USER_BY_USERNAME.get();

        try(
            Connection conn = dataSource.getConnection();
            PreparedStatement stmt = conn.prepareStatement(query)
        ) {
            stmt.setString(1, username);

            try(ResultSet rs = stmt.executeQuery()) {
                if(rs.next()) {
                    return mapUserFromResultSet(rs);
                }
            }
        }

        return null;
    }

    public List<_User> getAllUsers() throws SQLException {
        String query = CommandQueryManager.GET_ALL_USERS.get();
        List<_User> users = new ArrayList<>();

        try(
            Connection conn = dataSource.getConnection();
            PreparedStatement stmt = conn.prepareStatement(query);
            ResultSet rs = stmt.executeQuery()
        ) {
            while(rs.next()) {
                users.add(mapUserFromResultSet(rs));
            }
        }

        return users;
    }

    /* Session by User Id */
    public String getSessionByUserId(String userId) {
        return userToSessionMap.get(userId);
    }

    /* User Id by Session Id */
    public String getUserIdBySessison(String sessionId) {
        return sessionToUserMap.get(sessionId);
    } 

    /* Link */
    public void linkUserSession(String userId, String sessionId) {
        userToSessionMap.put(userId, sessionId);
        sessionToUserMap.put(sessionId, userId);
    }

    /* Unlink */
    public void unlinkUserSession(String sessionId) {
        String userId = sessionToUserMap.remove(sessionId);
        if(userId != null) userToSessionMap.remove(userId);
    }

    /*
    ** Send To User
    */
    public void sendMessageToUser(
        String sessionId,
        String event,
        Object data
    ) {
        try {
            eventTracker.track(
                event,
                data,
                EventDirection.SENT,
                sessionId,
                "system"
            );
            messagingTemplate.convertAndSendToUser(
                sessionId,
                "/queue/" + event,
                data
            );
        } catch(Exception err) {
            System.err.println("Error sending message: " + err.getMessage());
        }
    }

    /*
    **
    ***
    *** Routes
    ***
    **
    */
    public void handleUserRoute(RouteContext context) {
        String targetUserId = (String) context.message.get("targetUserId");
        if(targetUserId != null) {
            String targetSession = getSessionByUserId(targetUserId);
            if(targetSession != null) {
                context.targetSessions.add(targetSession);
                if(targetSession.equals(context.sessionId)) {
                    context.metadata.put("queue", "/user/queue/messages/self");
                } else {
                    Set<String> allSessions = connectionTracker.getAllActiveSessions();
                    allSessions.remove(context.sessionId);
                    context.targetSessions.addAll(allSessions);
                    context.metadata.put("queue", "/user/queue/messages/others");
                }
            }
        }
    }

    /*
    **
    ***
    *** Maps
    ***
    **
    */
    private _User mapUserFromResultSet(ResultSet rs) throws SQLException {
        _User user = new _User();
        user.setId(rs.getString("id"));
        user.setUsername(rs.getString("username"));
        user.setCreatedAt(rs.getTimestamp("created_at"));
        return user;
    }
}