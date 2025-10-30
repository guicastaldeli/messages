package com.app.main.root.app._service;
import com.app.main.root.app._types._User;
import com.app.main.root.app.EventTracker;
import com.app.main.root.app.EventLog.EventDirection;
import com.app.main.root.app._crypto.password.PasswordEncoderWrapper;
import com.app.main.root.app._db.CommandQueryManager;
import com.app.main.root.app._server.RouteContext;
import com.app.main.root.app._server.ConnectionTracker;
import org.springframework.context.annotation.Lazy;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import java.util.concurrent.ConcurrentHashMap;
import org.springframework.stereotype.Component;
import javax.sql.DataSource;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.sql.*;
import java.time.LocalDateTime;

@Component
public class UserService {
    private final DataSource dataSource;
    private final EventTracker eventTracker;
    private final ConnectionTracker connectionTracker;
    private final SimpMessagingTemplate messagingTemplate;
    private final ServiceManager serviceManager;
    private final PasswordEncoderWrapper passwordEncoder;
    public final Map<String, String> userToSessionMap = new ConcurrentHashMap<>();
    private final Map<String, String> sessionToUserMap = new ConcurrentHashMap<>();

    public UserService(
        DataSource dataSource,
        EventTracker eventTracker,
        ConnectionTracker connectionTracker,
        SimpMessagingTemplate messagingTemplate,
        @Lazy ServiceManager serviceManager,
        @Lazy PasswordEncoderWrapper passwordEncoder
    ) {
        this.dataSource = dataSource;
        this.eventTracker = eventTracker;
        this.connectionTracker = connectionTracker;
        this.messagingTemplate = messagingTemplate;
        this.serviceManager = serviceManager;
        this.passwordEncoder = passwordEncoder;
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

    /* Username */
    public String getUsernameBySessionId(String sessionId) {
        return sessionToUserMap.get(sessionId);
    }

    /* Session by User Id */
    public String getSessionByUserId(String userId) {
        return userToSessionMap.get(userId);
    }

    /* User Id by Session Id */
    public String getUserIdBySession(String sessionId) {
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
    *** Register User
    ***
    **
    */
    public Map<String, Object> registerUser(
        String username,
        String email,
        String password,
        String sessionId
    ) throws SQLException {
        if(username == null || username.trim().isEmpty()) throw new IllegalArgumentException("Username is required");
        if(email == null || serviceManager.getEmailService().isValidEmail(email)) throw new IllegalArgumentException("Email is required");
        if(password == null || password.length() < 8) throw new IllegalArgumentException("Password is required");

        String userId = "user_" + System.currentTimeMillis() + "_" + UUID.randomUUID().toString().substring(0, 12);
        String passwordHash = passwordEncoder.encode(password);
        String query = CommandQueryManager.REGISTER_USER.get();

        try(
            Connection conn = dataSource.getConnection();
            PreparedStatement stmt = conn.prepareStatement(query);
        ) {
            stmt.setString(1, userId);
            stmt.setString(2, username.trim());
            stmt.setString(3, email.toLowerCase().trim());
            stmt.setString(4, passwordHash);
            stmt.setString(5, sessionId);
            
            int rowsAffected = stmt.executeUpdate();
            if(rowsAffected > 0) {
                createProfile(conn, userId);
                serviceManager.getEmailService().sendWelcomeEmail(email, username, userId);
                linkUserSession(userId, sessionId);

                Map<String, Object> res = new HashMap<>();
                res.put("userId", userId);
                res.put("username", username);
                res.put("email", email);

                eventTracker.track(
                    "user-registred",
                    Map.of(
                        "userId", userId,
                        "username", username,
                        "email", email
                    ),
                    EventDirection.INTERNAL,
                    sessionId,
                    "System"
                );
                return res;
            } else {
                throw new SQLException("Failed to register user");
            }
        }
    }

    /*
    **
    ***
    *** Login User
    ***
    **
    */
    public Map<String, Object> loginUser(
        String accountEmail, 
        String password, 
        String sessionId
    ) throws SQLException {
        String query = CommandQueryManager.LOGIN_USER.get();
        try(
            Connection conn = dataSource.getConnection();
            PreparedStatement stmt = conn.prepareStatement(query)
        ) {
            stmt.setString(1, accountEmail.toLowerCase().trim());
            stmt.setString(2, accountEmail.trim());

            try(ResultSet rs = stmt.executeQuery()) {
                if(rs.next()) {
                    String storedHash = rs.getString("password_hash");
                    String userId = rs.getString("id");
                    String username = rs.getString("username");
                    String email = rs.getString("email");

                    if(passwordEncoder.matches(password, storedHash)) {
                        updateUserSession(conn, userId, sessionId);

                        Map<String, Object> res = new HashMap<>();
                        res.put("userId", userId);
                        res.put("username", username);
                        res.put("email", email);
                        res.put("sessionId", sessionId);

                        eventTracker.track(
                            "user-login",
                            Map.of(
                                "userId", userId,
                                "username", username
                            ),
                            EventDirection.RECEIVED,
                            sessionId,
                            username
                        );

                        return res;
                    }
                }
            }
        }

        throw new SecurityException("Invalid credentials");
    }

    /*
    * Create Profile 
    */
    private void createProfile(Connection conn, String userId) throws SQLException {
        String query = CommandQueryManager.CREATE_USER_PROFILE.get();
        try(PreparedStatement stmt = conn.prepareStatement(query)) {
            stmt.setString(1, userId);
            stmt.setString(2, "New User"); //Switch later
            stmt.executeUpdate();
        }
    }

    /*
    * Update Sesssion 
    */
    private void updateUserSession(Connection conn, String userId, String sessionId) throws SQLException {
        String query = CommandQueryManager.UPDATE_USER_SESSION.get();
        Timestamp time = Timestamp.valueOf(LocalDateTime.now());
        try(PreparedStatement stmt = conn.prepareStatement(query)) {
            stmt.setString(1, sessionId);
            stmt.setTimestamp(2, time);
            stmt.setString(3, userId);
            stmt.executeUpdate();
        }
        linkUserSession(userId, sessionId);
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