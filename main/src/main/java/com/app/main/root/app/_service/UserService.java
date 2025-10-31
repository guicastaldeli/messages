package com.app.main.root.app._service;
import com.app.main.root.app._db.DataSourceService;
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
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.sql.*;

@Component
public class UserService {
    private final DataSourceService dataSourceService;
    private final EventTracker eventTracker;
    private final ConnectionTracker connectionTracker;
    private final SimpMessagingTemplate messagingTemplate;
    private final ServiceManager serviceManager;
    private final PasswordEncoderWrapper passwordEncoder;
    public final Map<String, String> userToSessionMap = new ConcurrentHashMap<>();
    private final Map<String, String> sessionToUserMap = new ConcurrentHashMap<>();

    public UserService(
        DataSourceService dataSourceService,
        EventTracker eventTracker,
        ConnectionTracker connectionTracker,
        SimpMessagingTemplate messagingTemplate,
        @Lazy ServiceManager serviceManager,
        @Lazy PasswordEncoderWrapper passwordEncoder
    ) {
        this.dataSourceService = dataSourceService;
        this.eventTracker = eventTracker;
        this.connectionTracker = connectionTracker;
        this.messagingTemplate = messagingTemplate;
        this.serviceManager = serviceManager;
        this.passwordEncoder = passwordEncoder;
    }

    private Connection getConnection() throws SQLException {
        return dataSourceService.setDb("user").getConnection();
    }

    public void addUser(String id, String username, String sessionId) throws SQLException {
        String query = CommandQueryManager.ADD_USER.get();

        try(
            Connection conn = getConnection();
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
            Connection conn = getConnection();
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
            Connection conn = getConnection();
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
            Connection conn = getConnection();
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
        if(email == null || !serviceManager.getEmailService().isValidEmail(email)) throw new IllegalArgumentException("Email is required");
        if(password == null || password.length() < 8) throw new IllegalArgumentException("Password is required");

        String userId = "user_" + System.currentTimeMillis() + "_" + UUID.randomUUID().toString().substring(0, 12);
        //String passwordHash = passwordEncoder.encode(password);
        String query = CommandQueryManager.REGISTER_USER.get();
        String trimmedUsername = username.trim();

        try(
            Connection conn = getConnection();
            PreparedStatement stmt = conn.prepareStatement(query);
        ) {
            stmt.setString(1, userId);
            stmt.setString(2, trimmedUsername);
            stmt.setString(3, email.toLowerCase().trim());
            stmt.setString(4, password);
            stmt.setString(5, sessionId);
            
            int rowsAffected = stmt.executeUpdate();
            if(rowsAffected > 0) {
                createProfile(conn, userId);
                serviceManager.getEmailService().sendWelcomeEmail(email, username, userId);
                linkUserSession(userId, sessionId);

                Map<String, Object> res = new HashMap<>();
                res.put("userId", userId);
                res.put("username", trimmedUsername);
                res.put("email", email);

                eventTracker.track(
                    "user-registred",
                    Map.of(
                        "userId", userId,
                        "username", trimmedUsername,
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
            Connection conn = getConnection();
            PreparedStatement stmt = conn.prepareStatement(query)
        ) {
            stmt.setString(1, accountEmail.toLowerCase().trim());

            try(ResultSet rs = stmt.executeQuery()) {
                if(rs.next()) {
                    String storedHash = rs.getString("password_hash");
                    String userId = rs.getString("id");
                    String username = rs.getString("username");
                    String email = rs.getString("email");

                   // if(passwordEncoder.matches(password, storedHash)) {
                    if(password != null && storedHash != null && password.equals(storedHash)) {

                    
                        updateUserSession(conn, userId, sessionId);

                        Map<String, Object> res = new HashMap<>();
                        res.put("userId", userId);
                        res.put("email", email);
                        res.put("username", username);
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
                   // }
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
        _User user = new _User();
        try(PreparedStatement stmt = conn.prepareStatement(query)) {
            stmt.setString(1, userId);
            stmt.setString(2, user.getUsername());
            stmt.executeUpdate();
        }
    }

    public Map<String, Object> getUserProfile(String userId) throws SQLException {
        String query = CommandQueryManager.GET_USER_PROFILE.get();
        Map<String, Object> profile = new HashMap<>();

        try(
            Connection conn = getConnection();
            PreparedStatement stmt = conn.prepareStatement(query);
        ) {
            stmt.setString(1, userId);
            try(ResultSet rs = stmt.executeQuery()) {
                if(rs.next()) {
                    profile.put("displayName", rs.getString("display_name"));
                    profile.put("avatar_url", rs.getString("avatar_url"));
                    profile.put("createdAt", rs.getTime("created_at"));
                    profile.put("updatedAt", rs.getTime("updated_at"));
                }
            }
        }

        return profile;
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
    * Update Last Login 
    */
    public void updateLastLogin(String userId) throws SQLException {
        String query = CommandQueryManager.UPDATE_LAST_LOGIN.get();
        Timestamp time = Timestamp.valueOf(LocalDateTime.now());
        
        try(
            Connection conn = getConnection();
            PreparedStatement stmt = conn.prepareStatement(query);
        ) {
            stmt.setTimestamp(1, time);
            stmt.setString(2, userId);
            stmt.executeUpdate();
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
    * Is Online 
    */
    public List<_User> getOnlineUsers() throws SQLException {
        List<_User> allUsers = getAllUsers();
        List<_User> onlineUsers = new ArrayList<>();

        for(_User user : allUsers) {
            if(isUserOnline(user.getId())) {
                onlineUsers.add(user);
            }
        }

        return onlineUsers;
    }

    public boolean isUserOnline(String userId) {
        return userToSessionMap.containsKey(userId) &&
            userToSessionMap.get(userId) != null;
    }

    /*
    * Is Username Taken 
    */
    public boolean isUsernameTaken(String username) throws SQLException {
        return getUserByUsername(username) != null;
    }

    /*
    * Is Email Registered 
    */
    public _User getUserByEmail(String email) throws SQLException {
        String query = CommandQueryManager.GET_USER_BY_EMAIL.get();
        try(
            Connection conn = getConnection();
            PreparedStatement stmt = conn.prepareStatement(query);
        ) {
            stmt.setString(1, email.toLowerCase().trim());
            try(ResultSet rs = stmt.executeQuery()) {
                if(rs.next()) {
                    return mapUserFromResultSet(rs);
                }
            }
        }

        return null;
    }

    public boolean isEmailRegistered(String email) throws SQLException {
        return getUserByEmail(email) != null;
    }

    public boolean isValidEmail(String email) {
        if(email == null) return false;
        String regex = "^[A-Za-z0-9+_.-]+@(.+)$";
        return email.matches(regex);
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
        user.setEmail(rs.getString("email"));
        user.setCreatedAt(rs.getTimestamp("created_at"));
        return user;
    }

    private Map<String, Object> getUserBySessionInfo(String userId) throws SQLException {
        _User user = getUserById(userId);
        if(user == null) return null;

        Map<String, Object> userInfo = new HashMap<>();
        userInfo.put("id", user.getId());
        userInfo.put("username", user.getUsername());
        userInfo.put("email", user.getEmail());
        userInfo.put("isOnline", isUserOnline(userId));
        userInfo.put("sessionId", userToSessionMap.get(userId));
        userInfo.put("createdAt", user.getCreatedAt());
        return userInfo;
    }
}