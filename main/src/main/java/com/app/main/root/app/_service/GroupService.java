package com.app.main.root.app._service;
import com.app.main.root.app._types.User;
import com.app.main.root.app._types.Group;
import com.app.main.root.app.EventTracker;
import com.app.main.root.app.EventLog.EventDirection;
import com.app.main.root.app._crypto.message_encoder.PreKeyBundle;
import com.app.main.root.app._data.MemberVerifier;
import com.app.main.root.app._db.CommandQueryManager;
import com.app.main.root.app._db.DataSourceService;
import com.app.main.root.app._server.MessageRouter;
import com.app.main.root.app._server.RouteContext;
import com.app.main.root.app._data.SocketMethods;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Component;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArraySet;
import java.util.stream.Collectors;
import java.util.ArrayList;
import java.util.Date;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.sql.*;

@Component
public class GroupService {
    private final DataSourceService dataSourceService;
    private final MessageRouter messageRouter;
    private final EventTracker eventTracker;
    private final InviteCodeManager inviteCodeManager;
    private final SimpMessagingTemplate messagingTemplate;
    private final MemberVerifier memberVerifier;
    private final ServiceManager serviceManager;
    private final SocketMethods socketMethods;

    public final Map<String, Set<String>> groupSessions = new ConcurrentHashMap<>();
    private final Map<String, Set<String>> userGroups = new ConcurrentHashMap<>();
    private final Map<String, Set<String>> sessionGroups = new ConcurrentHashMap<>();

    public GroupService(
        DataSourceService dataSourceService, 
        SimpMessagingTemplate messagingTemplate,
        EventTracker eventTracker,
        MessageRouter messageRouter,
        MemberVerifier memberVerifier,
        ServiceManager serviceManager,
        SocketMethods socketMethods
    ) {
        this.dataSourceService = dataSourceService;
        this.messagingTemplate = messagingTemplate;
        this.eventTracker = eventTracker;
        try {
            this.inviteCodeManager = new InviteCodeManager(dataSourceService);
        } catch(Exception err) {
            throw new RuntimeException("Failed to init InviteCodeManager", err);
        }
        this.messageRouter = messageRouter;
        this.memberVerifier = memberVerifier;
        this.serviceManager = serviceManager;
        this.socketMethods = socketMethods;
    }

    private Connection getConnection() throws SQLException {
        return dataSourceService.setDb("group").getConnection();
    }

    public Map<String, Object> createGroup(
        String id,
        String name,
        String creatorId,
        String creatorName,
        String sessionId
    ) throws SQLException {
        String query = CommandQueryManager.CREATE_GROUP.get();
        Timestamp time = new Timestamp(System.currentTimeMillis());

        try(
            Connection conn = getConnection();
            PreparedStatement stmt = conn.prepareStatement(query)
        ) {
            stmt.setString(1, id);
            stmt.setString(2, name);
            stmt.setString(3, creatorId);
            int rowsAffected = stmt.executeUpdate();
            if(rowsAffected == 0) throw new SQLException("Failed to create gorup! :/");
        }

        boolean creatorAdded = addUserToGroup(id, creatorId, creatorName);
        if(!creatorAdded) throw new SQLException("Failed to add creator! :/");
        addUserToGroupMapping(creatorId, id, sessionId);

        MemberVerifier.VerificationResult verification = null;
        verification = memberVerifier.verifyCreator(id, creatorId, creatorId);
        if(!verification.isSuccess()) {
            eventTracker.track(
                "group-creation-verification-warning",
                Map.of(
                    "groupId", id,
                    "creatorId", creatorId,
                    "creatorName", creatorName,
                    "verificationMessage", verification.getMessage()
                ),
                EventDirection.INTERNAL,
                sessionId,
                creatorName
            );
        }

        List<User> members = getGroupMembers(id);
        List<String> memberIds = members.stream()
            .map(User::getId)
            .collect(Collectors.toList());

        try {
            if(!serviceManager.getMessageService().hasChatEncryption(id)) {
                PreKeyBundle bundle = serviceManager.getMessageService().getChatPreKeyBundle(id);
                serviceManager.getMessageService().initChatEncryption(id, bundle);
            }
        } catch(Exception err) {
            System.err.println("Failed to initialize group encryption: " + err.getMessage());
        }

        Map<String, Object> result = new HashMap<>();
        result.put("id", id);
        result.put("name", name);
        result.put("creatorId", creatorId);
        result.put("creatorName", creatorName);
        result.put("members", memberIds);
        result.put("memberDetails", members);
        result.put("totalMembers", members.size());
        result.put("createdAt", time);
        result.put("encryptionInit", true);
        if(verification != null) {
            result.put("verification", verification);
            result.put("verificationStatus", verification.isSuccess());
        }

        eventTracker.track(
            "group-created",
            result,
            EventDirection.INTERNAL,
            sessionId,
            creatorName
        );

        return result;
    }

    /**
     * Add User
     */
    public boolean addUserToGroup(String groupId, String userId, String username) throws SQLException {
        String query = CommandQueryManager.ADD_USER_TO_GROUP.get();
        boolean added = false;

        try(
            Connection conn = getConnection();
            PreparedStatement stmt = conn.prepareStatement(query);
        ) {
            try {
                stmt.setString(1, groupId);
                stmt.setString(2, userId);
                int rowsAffected = stmt.executeUpdate();
                added = rowsAffected > 0;
            } catch(SQLException err) {
                if(err.getMessage().contains("PRIMARY KEY")) {
                    System.out.println("User " + userId + " is already in group " + groupId);
                    added = true;
                } else {
                    throw err;
                }
            }
        }

        if(added) {
            MemberVerifier.VerificationResult verification = memberVerifier
                .verifyMember(groupId, userId, username);
            
            if(!verification.isSuccess()) {
                eventTracker.track(
                    "user-add-verification-failed",
                    Map.of(
                        "groupId", groupId,
                        "userId", userId,
                        "username", username,
                        "verificationMessage", verification.getMessage(),
                        "action", "logged_no_retry"
                    ),
                    EventDirection.INTERNAL,
                    "system",
                    "System"
                );
            }

            eventTracker.track(
                "user-added-to-group",
                Map.of(
                    "groupId", groupId,
                    "userId", userId,
                    "username", username,
                    "alreadyExists", !added
                ),
                EventDirection.INTERNAL,
                "system",
                "GroupService"
            );
        }
        return added;
    }

    public void addUserToGroupMapping(
        String userId, 
        String groupId, 
        String sessionId
    ) {
        userGroups.computeIfAbsent(userId, k -> new CopyOnWriteArraySet<>()).add(groupId);
        groupSessions.computeIfAbsent(groupId, k -> new CopyOnWriteArraySet<>()).add(sessionId);
        sessionGroups.computeIfAbsent(sessionId, k -> new CopyOnWriteArraySet<>()).add(groupId);
    }

    public Group getGroupId(String id) throws SQLException {
        String query = CommandQueryManager.GET_GROUP_BY_ID.get();

        try(
            Connection conn = getConnection();
            PreparedStatement stmt = conn.prepareStatement(query)
        ) {
            stmt.setString(1, id);
            try(ResultSet rs = stmt.executeQuery()) {
                if(rs.next()) {
                    return mapGroupFromResultSet(rs);
                }
            }
        }

        return null;
    }

    public List<User> getGroupMembers(String groupId) throws SQLException {
        String query = CommandQueryManager.GET_GROUP_MEMBERS.get();
        List<User> members = new ArrayList<>();

        try(
            Connection conn = getConnection();
            PreparedStatement stmt = conn.prepareStatement(query)
        ) {
            stmt.setString(1, groupId);
            try(ResultSet rs = stmt.executeQuery()) {
                while(rs.next()) {
                    User user = mapUserFromResultSet(rs);
                    try {
                        String username = serviceManager.getUserService().getUsernameByUserId(user.getId());
                        user.setUsername(username != null ? username : "Unknown");
                    } catch(Exception err) {
                        err.printStackTrace();
                        user.setUsername("Unknown **");
                    }
                    members.add(user);
                }
            }
        }

        return members;
    }

    public List<Group> getUserGroups(String userId) throws SQLException {
        String query = CommandQueryManager.GET_USER_GROUPS.get();
        List<Group> groups = new ArrayList<>();

        try(
            Connection conn = getConnection();
            PreparedStatement stmt = conn.prepareStatement(query)
        ) {
            stmt.setString(1, userId);
            try(ResultSet rs = stmt.executeQuery()) {
                while(rs.next()) {
                    groups.add(mapGroupFromResultSet(rs));
                }
            }
        }

        return groups;
    }

    public Set<String> getGroupSessionIds(String groupId) {
        Set<String> sessions = groupSessions.get(groupId);
        return sessions != null ? new HashSet<>(sessions) : new HashSet<>();
    }
    
    /**
     * Send to Group 
     */
    public void sendToGroup(String groupId, String event, Object data) {
        try {
            Set<String> sessions = groupSessions.get(groupId);
            if(sessions != null && !sessions.isEmpty()) {
                eventTracker.track(
                    event,
                    data,
                    EventDirection.SENT,
                    groupId,
                    "system"
                );

                for(String sessionId : sessions) {
                    if(isSessionInGroup(sessionId, groupId)) {
                        String destination = "/user/queue/messages/group/" + groupId; 
                        messagingTemplate.convertAndSend(destination, data);
                    }
                }
                System.out.println("Broadcasted to " + sessions.size() + " group members in group " + groupId);
            } else {
                System.out.println("No active sessions found for group " + groupId);
            }
        } catch(Exception err) {
            System.err.println("Error sending to group " + groupId + ": " + err.getMessage());
        }
    }

    public void sendToUserGroup(String groupId, String event, Object data) {
        try {
            Set<String> sessions = groupSessions.get(groupId);
            if(sessions != null && !sessions.isEmpty()) {
                eventTracker.track(
                    event,
                    data,
                    EventDirection.SENT,
                    groupId,
                    "system"
                );

                for(String sessionId : sessions) {
                    if(isSessionInGroup(sessionId, groupId)) {
                        String destination = "/user/queue/messages/group/" + groupId; 
                        messagingTemplate.convertAndSendToUser(
                            sessionId,
                            destination,
                            data
                        );
                    }
                }
                System.out.println("Broadcasted to " + sessions.size() + " group members in group " + groupId);
            } else {
                System.out.println("No active sessions found for group " + groupId);
            }
        } catch(Exception err) {
            System.err.println("Error sending to group " + groupId + ": " + err.getMessage());
        }
    }

    private boolean isSessionInGroup(String sessionId, String groupId) {
        Set<String> sessionGroups = this.sessionGroups.get(sessionId);
        return sessionGroups != null && sessionGroups.contains(groupId);
    }

    /**
     * Parse Data
     */
    public Map<String, Object> parseData(Object data) throws Exception {
        if(data instanceof Map) {
            return (Map<String, Object>) data;
        } else if(data instanceof String) {
            ObjectMapper mapper = new ObjectMapper();
            return mapper.readValue((String) data, Map.class);
        } else {
            throw new IllegalArgumentException("Group data must be Map or JSON String!");
        }
    }

    /**
     * Get Group Info 
     */
    public Map<String, Object> getGroupInfo(String id) throws SQLException {
        String groupQuery = CommandQueryManager.GET_GROUP_INFO.get();
        String membersQuery = CommandQueryManager.GET_GROUP_INFO_MEMBERS.get();
        Map<String, Object> info = new HashMap<>();

        try(
            Connection conn = getConnection();
            PreparedStatement groupStmt = conn.prepareStatement(groupQuery);
            PreparedStatement membersStmt = conn.prepareStatement(membersQuery);
        ) {
            /* Group Info */
            groupStmt.setString(1, id);
            try(ResultSet groupRs = groupStmt.executeQuery()) {
                if(groupRs.next()) {
                    info.put("id", groupRs.getString("id"));
                    info.put("name", groupRs.getString("name"));
                    info.put("creatorId", groupRs.getString("creator_id"));
                } else {
                    throw new SQLException("Group not found: " + id);
                }
            }

            /* Members Info */
            membersStmt.setString(1, id);
            List<Map<String, String>> members = new ArrayList<>();
            try(ResultSet membersRs = membersStmt.executeQuery()) {
                while(membersRs.next()) {
                    Map<String, String> member = new HashMap<>();
                    member.put("id", membersRs.getString("id"));
                    member.put("username", membersRs.getString("username"));
                    members.add(member);
                }
            }
            info.put("members", members);
            info.put("memberCount", members.size());
        }

        return info;
    }

    public boolean isUserGroupMember(String id, String userId) throws SQLException {
        String query = CommandQueryManager.IS_GROUP_MEMBER.get();

        try(
            Connection conn = getConnection();
            PreparedStatement stmt = conn.prepareStatement(query);
        ) {
            stmt.setString(1, id);
            stmt.setString(2, userId);
            try(ResultSet rs = stmt.executeQuery()) {
                if(rs.next()) {
                    return rs.getInt(1) > 0;
                }
            }
        }

        return false;
    }

    /**
     * Remove from Group 
     */
    public boolean removeUserFromGroup(String groupId, String userId) throws SQLException {
        String query = CommandQueryManager.REMOVE_USER_FROM_GROUP.get();
        boolean removed = false;

        try (
            Connection conn = getConnection();
            PreparedStatement stmt = conn.prepareStatement(query);
        ) {
            stmt.setString(1, groupId);
            stmt.setString(2, userId);
            int rowsAffected = stmt.executeUpdate();
            removed = rowsAffected > 0;
        }

        if(removed) {
            MemberVerifier.VerificationResult verification = memberVerifier
                .verifyMember(groupId, userId, "RemovedUser");

            if(verification.isSuccess()) {
                eventTracker.track(
                    "user-removal-verification-failed",
                    Map.of(
                        "groupId", groupId,
                        "userId", userId,
                        "verificationMessage", "User still exists in group after removal"
                    ),
                    EventDirection.INTERNAL,
                    "system",
                    "GroupService"
                );
                removed = false;
            }
        }

        if(removed) {
            eventTracker.track(
                "user-removed-from-group",
                Map.of(
                    "groupId", groupId,
                    "userId", userId
                ),
                EventDirection.INTERNAL,
                "system",
                "GroupService"
            );
        }

        return removed;
    }

    /**
     * Remove from Group Mapping
     */
    public void removeUserFromGroupMapping(String userId, String groupId) {
        Set<String> userGroupSet = userGroups.get(userId);
        if(userGroupSet != null) {
            userGroupSet.remove(groupId);
            if(userGroupSet.isEmpty()) {
                userGroups.remove(userId);
            }
        }

        Set<String> groupSessionSet = groupSessions.get(groupId);
        if(groupSessionSet != null) {
            groupSessionSet.remove(userId);
            if(groupSessionSet.isEmpty()) {
                groupSessions.remove(groupId);
            }
        }
    }

    /**
     * Remove from All Groups 
     */
    public void removeUserFromAllGroups(String userId) {
        Set<String> userGroupSet = userGroups.get(userId);
        if(userGroupSet != null) {
            for(String groupId : userGroupSet) {
                removeUserFromGroupMapping(userId, groupId);
            }
        }
        userGroups.remove(userId);
    }

    /**
     * Update Sessions for User 
     */
    public void updateGroupSessionsUser(String userId, String sessionId) {
        Set<String> userGroupSet = userGroups.get(userId);
        if(userGroupSet != null) {
            for(String groupId : userGroupSet) {
                groupSessions.computeIfAbsent(groupId, k -> new CopyOnWriteArraySet<>()).add(sessionId);
            }
        }
    }

    /**
     * Update Last Message
     */
    public void updateLastMessage(
        String groupId,
        String lastMessage,
        String lastSender,
        Timestamp lastMessageTime
    ) throws SQLException {
        String query = CommandQueryManager.UPDATE_GROUP_LAST_MESSAGE.get();
        try (
            Connection conn = getConnection();
            PreparedStatement stmt = conn.prepareStatement(query);
        ) {
            stmt.setString(1, lastMessage);
            stmt.setString(2, lastSender);
            stmt.setTimestamp(3, lastMessageTime);
            stmt.setString(4, groupId);
            stmt.executeUpdate();
        }
    }

    public void broadcastLastMessageUpdate(
        String groupId,
        String lastMessage,
        String lastSender,
        Timestamp time
    ) {
        Date now = new Date();

        try {
            Map<String, Object> updateEvent = new HashMap<>();
            updateEvent.put("type", "LAST_MESSAGE_SENT");
            updateEvent.put("groupId", groupId);
            updateEvent.put("lastMessage", lastMessage);
            updateEvent.put("lastSender", lastSender);
            updateEvent.put("lastTimeMessage", time);
            updateEvent.put("timestamp", now);

            sendToGroup(groupId, "last_message_updated", updateEvent);
        } catch(Exception err) {
            System.err.println("Err broadcasting last message group:" + err.getMessage());
        }
    }

    /**
     * Creation Message 
     */
    public void sendCreationMessage(String sessionId, String id, String groupName, String creator) throws SQLException {
        List<User> members = getGroupMembers(id);
        try {
            Thread.sleep(1000);
        } catch(InterruptedException e) {
            Thread.currentThread().interrupt();
        }

        for(User member : members) {
            String memberSessionId = serviceManager.getUserService().getSessionByUserId(member.getId());
            if(memberSessionId != null && serviceManager.getUserService().isSessionActive(memberSessionId)) {
                Map<String, Object> systemMessage = serviceManager.getSystemMessageService().createAndSaveMessage(
                    "GROUP_CREATED", 
                    Map.of("groupName", groupName, "creator", creator), 
                    sessionId, 
                    memberSessionId,
                    id
                );
                
                String destination = "/user/queue/messages/group/" + id;
                socketMethods.send(memberSessionId, destination, systemMessage);
            }
        }
    }

    /**
     * 
     * Routes
     * 
     */
    public void handleGroupRoutes(RouteContext context) {
        handleGroupRoute(context);
        handleGroupSelfRoute(context);
        handleGroupOthersRoute(context);
    }

    private void handleGroupRoute(RouteContext context) {
        String chatId = (String) context.message.get("chatId");
        if(chatId != null && chatId.startsWith("group_")) {
            try {
                if(!serviceManager.getMessageService().hasChatEncryption(chatId)) {
                    PreKeyBundle bundle = serviceManager.getMessageService().getChatPreKeyBundle(chatId);
                    serviceManager.getMessageService().initChatEncryption(chatId, bundle);
                }
            } catch(Exception err) {
                System.err.println("Group encryption init failed: " + err.getMessage());
            }
            
            Set<String> groupSessions = this.groupSessions.get(chatId);
            if(groupSessions != null) {
                Set<String> validSessions = new HashSet<>();
                for(String sessionId : groupSessions) {
                    if(isSessionInGroup(sessionId, chatId)) {
                        validSessions.add(sessionId);
                    }
                }
                context.targetSessions.addAll(validSessions);
                context.metadata.put("groupId", chatId);
                context.metadata.put("queue", "/user/queue/messages/group/" + chatId);
            }
        }
    }

    /**
     * 
     * Perspective
     * 
     */
    private void handleGroupSelfRoute(RouteContext context) {
        String chatId = (String) context.message.get("chatId");
        context.targetSessions.add(context.sessionId);
        context.metadata.put("queue", "/user/queue/messages/group/" + chatId + "/self");
    }

    private void handleGroupOthersRoute(RouteContext context) {
        String chatId = (String) context.message.get("chatId");
        if(chatId != null && chatId.startsWith("group_")) {
            Set<String> groupSessions = this.groupSessions.get(chatId);
            if(groupSessions != null) {
                Set<String> otherSessions = new HashSet<>(groupSessions);
                otherSessions.remove(context.sessionId);
                context.targetSessions.addAll(groupSessions);
                context.metadata.put("queue", "/user/queue/messages/group/" + chatId + "/others");
            }
        }
    }

    /**
     * 
     * Maps
     * 
     */
    private Group mapGroupFromResultSet(ResultSet rs) throws SQLException {
        Group group = new Group();
        group.setId(rs.getString("id"));
        group.setName(rs.getString("name"));
        group.setCreatorId(rs.getString("creator_id"));
        group.setCreatedAt(rs.getTimestamp("created_at"));
        return group;
    }

    private User mapUserFromResultSet(ResultSet rs) throws SQLException {
        User user = new User();
        user.setId(rs.getString("id"));
        user.setUsername(rs.getString("username"));
        user.setCreatedAt(rs.getTimestamp("created_at"));
        return user;
    }

    /**
     * Get Invite Codes 
     */
    public InviteCodeManager getInviteCodes() {
        return inviteCodeManager;
    }
}