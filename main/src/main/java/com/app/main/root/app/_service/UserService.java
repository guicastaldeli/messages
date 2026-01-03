package com.app.main.root.app._service;
import com.app.main.root.app._db.DataSourceService;
import com.app.main.root.app._types._User;
import com.app.main.root.app.EventTracker;
import com.app.main.root.app.EventLog.EventDirection;
import com.app.main.root.app._crypto.password_encoder.PasswordEncoderWrapper;
import com.app.main.root.app._crypto.user_validator.UserValidatorWrapper;
import com.app.main.root.app._db.CommandQueryManager;
import com.app.main.root.app._server.RouteContext;
import com.app.main.root.app._server.ConnectionTracker;
import org.springframework.context.annotation.Lazy;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import java.util.concurrent.CompletableFuture;
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
    private final UserValidatorWrapper userValidator;
    public final Map<String, String> userToSessionMap = new ConcurrentHashMap<>();
    private final Map<String, String> sessionToUserMap = new ConcurrentHashMap<>();

    public UserService(
        DataSourceService dataSourceService,
        EventTracker eventTracker,
        ConnectionTracker connectionTracker,
        SimpMessagingTemplate messagingTemplate,
        @Lazy ServiceManager serviceManager,
        @Lazy PasswordEncoderWrapper passwordEncoder,
        UserValidatorWrapper userValidator
    ) {
        this.dataSourceService = dataSourceService;
        this.eventTracker = eventTracker;
        this.connectionTracker = connectionTracker;
        this.messagingTemplate = messagingTemplate;
        this.serviceManager = serviceManager;
        this.passwordEncoder = passwordEncoder;
        this.userValidator = userValidator;
    }

    private Connection getConnection() throws SQLException {
        return dataSourceService.setDb("user").getConnection();
    }

    /**
     * Add User
     */
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

    /**
     * Get User by Id
     */
    public _User getUserById(String id) throws SQLException {
        String query = CommandQueryManager.GET_USER_BY_ID.get();

        try(
            Connection conn = getConnection();
            PreparedStatement stmt = conn.prepareStatement(query)
        ) {
            stmt.setString(1, id);

            try(ResultSet rs = stmt.executeQuery()) {
                if(rs.next()) {
                    _User user = mapUserFromResultSet(rs);
                    System.out.println("User found: " + user.getUsername());
                    return user;
                } else {
                    System.out.println("ERROR: No user found with ID: " + id);
                    return null;
                }
            }
        }
    }

    /**
     * Get User by Username
     */
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

    /**
     * Get User Chats 
     */
    public List<Map<String, Object>> getUserDirect(String userId) throws SQLException {
        String query = CommandQueryManager.GET_USER_DIRECT.get();
        List<Map<String, Object>> chats = new ArrayList<>();

        try(
            Connection conn = getConnection();
            PreparedStatement stmt = conn.prepareStatement(query);
        ) {
            stmt.setString(1, userId);
            try(ResultSet rs = stmt.executeQuery()) {
                while(rs.next()) {
                    Map<String, Object> chat = new HashMap<>();
                    String contactId = rs.getString("contact_id");
                    Map<String, Object> idMap = serviceManager.getDirectService().getChatId(userId, contactId);
                    String id = (String) idMap.get("chatId");

                    chat.put("id", id);
                    chat.put("contactId", contactId);
                    chat.put("contactUsername", rs.getString("username"));
                    chat.put("type", "DIRECT");
                    chats.add(chat);
                }
            }
        }

        return chats;
    }

    public List<Map<String, Object>> getUserGroups(String userId) throws SQLException {
        String query = CommandQueryManager.GET_USER_GROUPS.get();
        List<Map<String, Object>> groups = new ArrayList<>();

        try(
            Connection conn = dataSourceService.setDb("group").getConnection();
            PreparedStatement stmt = conn.prepareStatement(query)
        ) {
            stmt.setString(1, userId);
            try(ResultSet rs = stmt.executeQuery()) {
                while(rs.next()) {
                    Map<String, Object> group = new HashMap<>();
                    group.put("id", rs.getString("id"));
                    group.put("name", rs.getString("name"));
                    group.put("creatorId", rs.getString("creator_id"));
                    group.put("createdAt", rs.getString("created_at"));
                    group.put("memberCount", rs.getString("member_count"));
                    group.put("type", "GROUP");
                    groups.add(group);
                }
            }
        }

        return groups;
    }

    /**
     * Username
     */
    public String getUsernameBySessionId(String sessionId) {
        return sessionToUserMap.get(sessionId);
    }

    /**
     * Session by User Id
     */
    public String getSessionByUserId(String userId) {
        return userToSessionMap.get(userId);
    }

    /**
     * Username by User Id
     */
    public String getUsernameByUserId(String userId) throws SQLException {
        _User user = getUserById(userId);
        if(user == null) System.out.println("Err user" + userId);
        String username = user.getUsername();
        if(username == null) System.out.println("Err username" + username);
        return username;
    }

    /**
     * Link Session
     */
    public void linkUserSession(String userId, String sessionId) {
        userToSessionMap.put(userId, sessionId);
        sessionToUserMap.put(sessionId, userId);
    }

    /**
     * Unlink Session
     */
    public void unlinkUserSession(String sessionId) {
        String userId = sessionToUserMap.remove(sessionId);
        if(userId != null) userToSessionMap.remove(userId);
    }

    /**
     * Send Socket Message to User
     */
    public void sendMessageToUser(
        String sessionId,
        String event,
        Object data
    ) {
        try {
            if(sessionId == null || sessionId.isEmpty() || !isSessionActive(sessionId)) {
                System.out.println("Session " + sessionId + " is not active, skipping message: " + event);
                return;
            }

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
            if(!err.getMessage().contains("No session") && !err.getMessage().contains("not found")) {
                System.err.println("Error sending message to session " + sessionId + ": " + err.getMessage());
            }
        }
    }

    /**
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

    /**
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

    /**
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

    /**
     * Username Taken
     */
    public boolean isUsernameTaken(String username) throws SQLException {
        return getUserByUsername(username) != null;
    }

    /**
     * Get User By Email
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

    /**
     * User Id 
     */
    private String generateUserId() {
        String userId = "user_" + System.currentTimeMillis() + "_" + UUID.randomUUID().toString().substring(0, 12);
        return userId;
    }

    public String getUserIdBySession(String sessionId) {
        return sessionToUserMap.get(sessionId);
    } 

    /**
     * 
     * Profile
     *  
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

    /**
     * 
     * Register User
     * 
     */
    public Map<String, Object> registerUser(
        String username,
        String email,
        String password,
        String sessionId,
        String ipAddress
    ) throws SQLException {
        if(!userValidator.validateRegistration(username, email, password, ipAddress)) {
            throw new IllegalArgumentException("Invalid registration data!");
        }
        userValidator.recordRegistrationAttempt(ipAddress);

        if(username == null || username.trim().isEmpty()) throw new IllegalArgumentException("Username is required");
        if(email == null || !serviceManager.getEmailService().isValidEmail(email)) throw new IllegalArgumentException("Email is required");
        if(password == null || password.length() < 8) throw new IllegalArgumentException("Password is required");

        String userId = generateUserId();
        String passwordHash = passwordEncoder.encode(password);
        String query = CommandQueryManager.REGISTER_USER.get();
        String trimmedUsername = username.trim();

        try(
            Connection conn = getConnection();
            PreparedStatement stmt = conn.prepareStatement(query);
        ) {
            stmt.setString(1, userId);
            stmt.setString(2, trimmedUsername);
            stmt.setString(3, email.toLowerCase().trim());
            stmt.setString(4, passwordHash);
            stmt.setString(5, sessionId);
            
            int rowsAffected = stmt.executeUpdate();
            if(rowsAffected > 0) {
                createProfile(conn, userId);
                CompletableFuture.runAsync(() -> {
                    serviceManager.getEmailService().sendWelcomeEmail(email, username, userId);
                });
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

    /**
     * 
     * Login User
     * 
     */
    public Map<String, Object> loginUser(
        String accountEmail, 
        String password, 
        String sessionId,
        String ipAddress
    ) throws SQLException {
        if(!userValidator.validateLogin(accountEmail, password, ipAddress)) {
            throw new SecurityException("Invalid login data!");
        }
        userValidator.recordLoginAttempt(ipAddress);
        
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
                    
                    if(passwordEncoder.matches(password, storedHash)) {
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
                }
            }
        }

        throw new SecurityException("Invalid credentials");
    }

    /**
     * 
     * Routes
     * 
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

    /**
     * 
     * Maps
     * 
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

    public boolean isSessionActive(String sessionId) {
        if(sessionId == null || sessionId.isEmpty()) {
            return false;
        }
        
        return sessionToUserMap.containsKey(sessionId) ||
            userToSessionMap.containsValue(sessionId);
    }
}