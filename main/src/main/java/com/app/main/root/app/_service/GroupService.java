package com.app.main.root.app._service;
import com.app.main.root.app._types._User;
import com.app.main.root.app._types._Group;
import com.app.main.root.app.EventTracker;
import com.app.main.root.app.EventLog.EventDirection;
import com.app.main.root.app._data.CommandSystemMessageList;
import com.app.main.root.app._data.MemberVerifier;
import com.app.main.root.app._db.CommandQueryManager;
import com.app.main.root.app._server.MessageRouter;
import com.app.main.root.app._server.RouteContext;
import com.app.main.root.app._data.SocketMethods;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Component;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArraySet;
import java.util.stream.Collectors;
import javax.sql.DataSource;
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
    private final MessageRouter messageRouter;
    private final DataSource dataSource;
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
        DataSource dataSource, 
        SimpMessagingTemplate messagingTemplate,
        EventTracker eventTracker,
        MessageRouter messageRouter,
        MemberVerifier memberVerifier,
        ServiceManager serviceManager,
        SocketMethods socketMethods
    ) {
        this.dataSource = dataSource;
        this.messagingTemplate = messagingTemplate;
        this.eventTracker = eventTracker;
        try {
            this.inviteCodeManager = new InviteCodeManager(dataSource);
        } catch(Exception err) {
            throw new RuntimeException("Failed to init InviteCodeManager", err);
        }
        this.messageRouter = messageRouter;
        this.memberVerifier = memberVerifier;
        this.serviceManager = serviceManager;
        this.socketMethods = socketMethods;
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
            Connection conn = dataSource.getConnection();
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

        List<_User> members = getGroupMembers(id);
        List<String> memberIds = members.stream()
            .map(_User::getId)
            .collect(Collectors.toList());

        Map<String, Object> result = new HashMap<>();
        result.put("id", id);
        result.put("name", name);
        result.put("creatorId", creatorId);
        result.put("creatorName", creatorName);
        result.put("members", memberIds);
        result.put("memberDetails", members);
        result.put("totalMembers", members.size());
        result.put("createdAt", time);
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

    /*
    * Add User 
    */
    public boolean addUserToGroup(String groupId, String userId, String username) throws SQLException {
        String query = CommandQueryManager.ADD_USER_TO_GROUP.get();
        boolean added = false;

        try(
            Connection conn = dataSource.getConnection();
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

    public _Group getGroupId(String id) throws SQLException {
        String query = CommandQueryManager.GET_GROUP_BY_ID.get();

        try(
            Connection conn = dataSource.getConnection();
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

    public List<_User> getGroupMembers(String groupId) throws SQLException {
        String query = CommandQueryManager.GET_GROUP_MEMBERS.get();
        List<_User> members = new ArrayList<>();

        try(
            Connection conn = dataSource.getConnection();
            PreparedStatement stmt = conn.prepareStatement(query)
        ) {
            stmt.setString(1, groupId);
            try(ResultSet rs = stmt.executeQuery()) {
                while(rs.next()) {
                    members.add(mapUserFromResultSet(rs));
                }
            }
        }

        return members;
    }

    public List<_Group> getUserGroups(String userId) throws SQLException {
        String query = CommandQueryManager.GET_USER_GROUPS.get();

        List<_Group> groups = new ArrayList<>();

        try(
            Connection conn = dataSource.getConnection();
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
    
    /*
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
                    if (isSessionInGroup(sessionId, groupId)) {
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
                    if (isSessionInGroup(sessionId, groupId)) {
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

    /*
    * Parser 
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

    /*
    * Get Group Info 
    */
    public Map<String, Object> getGroupInfo(String id) throws SQLException {
        String groupQuery = CommandQueryManager.GET_GROUP_INFO.get();
        String membersQuery = CommandQueryManager.GET_GROUP_INFO_MEMBERS.get();
        Map<String, Object> info = new HashMap<>();

        try(
            Connection conn = dataSource.getConnection();
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
            Connection conn = dataSource.getConnection();
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

    /*
    * Remove from Group 
    */
    public boolean removeUserFromGroup(String groupId, String userId) throws SQLException {
        String query = CommandQueryManager.REMOVE_USER_FROM_GROUP.get();
        boolean removed = false;

        try (
            Connection conn = dataSource.getConnection();
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

    /*
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

    /*
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

    /*
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

    /*
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
            Connection conn = dataSource.getConnection();
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

    /*
    * Creation Message 
    */
    public void sendCreationMessage(String sessionId, String id, String groupName, String creator) {
        new Thread(new Runnable() {
            @Override
            public void run() {
                try {
                    Thread.sleep(2000);
                    String destination = "/user/queue/messages/group/" + id;
                                
                    Map<String, Object> systemMessageData = new HashMap<>();
                    systemMessageData.put("groupId", id);
                    systemMessageData.put("chatId", id);
                    systemMessageData.put("groupName", groupName);
                    systemMessageData.put("username", creator);
    
                    serviceManager.getSystemMessageService().setContent(
                        CommandSystemMessageList.GROUP_CREATED.get(), 
                        systemMessageData, 
                        sessionId, 
                        sessionId
                    );
                    Map<String, Object> systemMessage = serviceManager.getSystemMessageService().createAndSaveMessage(
                        "GROUP_CREATED", 
                        systemMessageData, 
                        sessionId, 
                        sessionId,
                        id
                    );
                    systemMessage.put("groupId", id);
                    systemMessage.put("chatId", id);
                    systemMessage.put("chatType", "GROUP");
                    systemMessage.put("isSystem", true);
    
                    Object systemMessagePayload = serviceManager.getSystemMessageService().payload(
                        "GROUP_CREATED", 
                        systemMessage, 
                        id, 
                        id
                    );
    
                    try {
                        messageRouter.routeMessage(sessionId, systemMessagePayload, systemMessage, new String[]{"GROUP"});
                        socketMethods.send(sessionId, destination, systemMessagePayload);
                    } catch(Exception err) {
                        System.err.println("Failed to route system message" + err.getMessage());
                        socketMethods.send(sessionId, destination, systemMessagePayload);
                    }
                } catch(InterruptedException err) {
                    Thread.currentThread().interrupt();
                } catch(Exception err) {
                    System.err.println("Error in system message thread" + err.getMessage()); 
                }
            }
        }).start();
    }

    /*
    **
    ***
    *** Routes
    ***
    **
    */
    public void handleGroupRoutes(RouteContext context) {
        handleGroupRoute(context);
        handleGroupSelfRoute(context);
        handleGroupOthersRoute(context);
    }

    /* Group */
    private void handleGroupRoute(RouteContext context) {
        String chatId = (String) context.message.get("chatId");
        if(chatId != null && chatId.startsWith("group_")) {
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

    /*
    **
    ***
    *** Perspective
    ***
    **
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

    /*
    **
    ***
    *** Maps
    ***
    **
    */
    private _Group mapGroupFromResultSet(ResultSet rs) throws SQLException {
        _Group group = new _Group();
        group.setId(rs.getString("id"));
        group.setName(rs.getString("name"));
        group.setCreatorId(rs.getString("creator_id"));
        group.setCreatedAt(rs.getTimestamp("created_at"));
        return group;
    }

    private _User mapUserFromResultSet(ResultSet rs) throws SQLException {
        _User user = new _User();
        user.setId(rs.getString("id"));
        user.setUsername(rs.getString("username"));
        user.setCreatedAt(rs.getTimestamp("created_at"));
        return user;
    }

    /*
    * Invite Codes 
    */
    public InviteCodeManager getInviteCodes() {
        return inviteCodeManager;
    }
}