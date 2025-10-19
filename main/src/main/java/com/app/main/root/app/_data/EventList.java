package com.app.main.root.app._data;
import com.app.main.root.EnvConfig;
import com.app.main.root.app.EventTracker;
import com.app.main.root.app.EventLog.EventDirection;
import com.app.main.root.app._db.DbService;
import com.app.main.root.app._server.ConnectionTracker;
import com.app.main.root.app._types._User;
import com.app.main.root.app._server.ConnectionInfo;
import com.app.main.root.app.main._messages_config.MessageLog;
import com.app.main.root.app.main._messages_config.MessageTracker;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;

import org.springframework.stereotype.Component;
import java.util.*;

@Component
public class EventList {
    private final DbService dbService;
    private final EventTracker eventTracker;
    private final ConnectionTracker connectionTracker;
    private final SocketMethods socketMethods;
    private final MessageTracker messageTracker;

    public EventList(
        DbService dbService,
        EventTracker eventTracker,
        ConnectionTracker connectionTracker,
        SocketMethods socketMethods,
        MessageTracker messageTracker
    ) {
        this.eventTracker = eventTracker;
        this.dbService = dbService;
        this.connectionTracker = connectionTracker;
        this.socketMethods = socketMethods;
        this.messageTracker = messageTracker;
    }

    public Map<String, EventConfig> list() {
        Map<String, EventConfig> configs = new HashMap<>();

        /* Socket Id */
        configs.put("get-socket-id", new EventConfig(
            (sessionId, payload, headerAccessor) -> {
                long time = System.currentTimeMillis();

                eventTracker.track(
                    "get-socket-id",
                    payload,
                    EventDirection.RECEIVED,
                    sessionId,
                    sessionId
                );

                Map<String, Object> res = new HashMap<>();
                res.put("socketId", sessionId);
                res.put("timestamp", time);
                res.put("status", "success");
                return res;
            },
            "/queue/socket-id",
            false
        ));
        /* New User */
        configs.put("new-user", new EventConfig(
            (sessionId, payload, headerAccess) -> {
                long time = System.currentTimeMillis();
                Map<String, Object> data = (Map<String, Object>) payload;
                String username = (String) data.get("username");
                String userId = (String) data.get("userId");

                eventTracker.track(
                    "new-user",
                    username,
                    EventDirection.RECEIVED,
                    sessionId,
                    username
                );
                connectionTracker.updateUsername(sessionId, username);

                try {
                    String actualUserId = userId != null ? userId : sessionId;
                    dbService.getUserService().addUser(actualUserId, username, sessionId);
                    ConnectionInfo connectionInfo = connectionTracker.getConnection(sessionId);
                    if(connectionInfo != null) connectionTracker.logUsernameSet(connectionInfo, username);
                } catch(Exception err) {
                    System.out.println("Failed to add user: " + err.getMessage());
                }

                Map<String, Object> res = new HashMap<>();
                res.put("type", "USER_JOINED");
                res.put("userId", userId);
                res.put("username", username);
                res.put("sessionId", sessionId);
                res.put("timestamp", time);
                return res;
            },
            "/topic/user",
            true
        ));
        /* Chat */
        configs.put("chat", new EventConfig(
            (sessionId, payload, headerAccessor) -> {
                Map<String, Object> messageData = (Map<String, Object>) payload;
                String content = (String) messageData.get("content");
                String chatId = (String) messageData.get("chatId");
                String username = socketMethods.getSocketUsername(sessionId);
                String chatSocket = chatId != null ? chatId : sessionId; 
                String messageId = "msg_" + System.currentTimeMillis() + "_" + UUID.randomUUID().toString().substring(0, 8);
                long time = System.currentTimeMillis();

                messageTracker.track(
                    messageId, 
                    content, 
                    messageId,
                    username, 
                    chatId, 
                    MessageLog.MessageType.GROUP, 
                    MessageLog.MessageDirection.SENT
                );
                eventTracker.track(
                    "chat",
                    payload,
                    EventDirection.RECEIVED,
                    sessionId,
                    content
                );

                try {
                    dbService.getMessageService().saveMessage(sessionId, chatSocket, content, "text");
                } catch(Exception err) {
                    System.err.println("Failed to save message: " + err.getMessage());
                }

                Map<String, Object> response = new HashMap<>();
                response.put("username", username);
                response.put("content", content);
                response.put("senderId", sessionId);
                response.put("chatId", chatSocket);
                response.put("messageId", messageId);
                response.put("timestamp", time);

                socketMethods.send(
                    sessionId,
                    "/queue/message-sent",
                    response
                );

                //socketMethods.broadcast("chat", response);
                return response;
            },
            "/topic/chat",
            true
        ));
        /* Exit User */
        configs.put("exit-user", new EventConfig(
            (sessionId, payload, headerAccessor) -> {
                String user = (String) payload;
                long time = System.currentTimeMillis();
                
                eventTracker.track(
                    "exit-user", 
                    user, 
                    EventDirection.RECEIVED, 
                    sessionId, 
                    user
                );
                
                Map<String, Object> updateMessage = new HashMap<>();
                updateMessage.put("type", "USER_LEFT");
                updateMessage.put("username", user);
                updateMessage.put("sessionId", sessionId);
                updateMessage.put("timestamp", time);
                return updateMessage;
            },
            "/topic/users",
            true
        ));
        /* Create Group */
        configs.put("create-group", new EventConfig(
            (sessionId, payload, headerAccessor) -> {
                try {
                    Map<String, Object> groupData = dbService.getGroupService().parseData(payload);
                    String format = UUID.randomUUID().toString().substring(0, 7);
                    String id = "group_" + System.currentTimeMillis() + "_" + format;
                    String creator = (String) groupData.get("creator");
                    String creatorId = (String) groupData.get("creatorId");
                    String groupName = (String) groupData.get("groupName");
                    String creationDate = LocalDateTime.now().format(DateTimeFormatter.ISO_LOCAL_DATE_TIME);

                    dbService.getGroupService().createGroup(id, groupName, creatorId);
                    dbService.getGroupService().addUserToGroup(id, creatorId);

                    List<_User> members = dbService.getGroupService().getGroupMembers(id);
                    List<String> memberUserId = new ArrayList<>();
                    for(_User member : members) memberUserId.add(member.getId());

                    Map<String, Object> newGroup = new HashMap<>();
                    newGroup.put("id", id);
                    newGroup.put("name", groupName);
                    newGroup.put("creator", creator);
                    newGroup.put("creatorId", creatorId);
                    newGroup.put("members", memberUserId);
                    newGroup.put("createdAt", creationDate);

                    eventTracker.track(
                        "create-group", 
                        newGroup, 
                        EventDirection.RECEIVED, 
                        sessionId, 
                        creator
                    );

                    return newGroup;
                } catch(Exception err) {
                    socketMethods.send(
                        sessionId, 
                        "/user/topic/group-creation-err", 
                        err.getMessage()
                    );
                    return Collections.emptyMap();
                }
            },
            "/queue/group-creation-scss",
            false
        ));
        /* Join Group */
        configs.put("join-group", new EventConfig(
            (sessionId, payload, headerAccessor) -> {
                try {
                    Map<String, Object> data = dbService.getGroupService().parseData(payload);
                    String groupId = (String) data.get("groupId");
                    String userId = socketMethods.getSocketUsername(sessionId);
                    long time = System.currentTimeMillis();
                    if(groupId == null || userId == null) throw new Exception("Group Id or User Id are required!");

                    boolean success = dbService.getGroupService().addUserToGroup(groupId, sessionId);
                    if(!success) throw new Exception("Failed to join group :(");

                    Map<String, Object> groupInfo = dbService.getGroupService().getGroupInfo(groupId);
                    eventTracker.track(
                        "join-group",
                        data,
                        EventDirection.RECEIVED,
                        sessionId,
                        userId
                    );

                    Map<String, Object> res = new HashMap<>();
                    res.put("groupId", groupId);
                    res.put("groupName", groupInfo.get("name"));
                    res.put("userId", userId);
                    res.put("joined", true);
                    res.put("timestamp", time);
                    res.put("members", groupInfo.get("members"));
                    return res;
                } catch(Exception err) {
                    Map<String, Object> errRes = new HashMap<>();
                    errRes.put("error", "JOIN_FAILED");
                    errRes.put("message", err.getMessage());
                    socketMethods.send(sessionId, "/queue/join-group-err", errRes);
                    return Collections.emptyMap();
                }
            },
            "/queue/join-group-scss",
            false
        ));
        /* Generate Group Link */
        configs.put("generate-invite-link", new EventConfig(
            (sessionId, payload, headerAccessor) -> {
                Map<String, Object> res = new HashMap<>();

                try {
                    Map<String, Object> reqData = (Map<String, Object>) payload;
                    String groupId = (String) reqData.get("groupId");
                    String userId = socketMethods.getSocketUsername(sessionId);
                    boolean isMember = dbService.getGroupService().isUserGroupMember(groupId, userId);

                    if(groupId == null || groupId.trim().isEmpty()) {
                        throw new IllegalArgumentException("Group Id is required");
                    }
                    if(userId == null || userId.trim().isEmpty()) {
                        throw new IllegalArgumentException("User Id is required");
                    }
                    if (!isMember) {
                        throw new SecurityException("User: " + userId + ", is not a member of group: " + groupId);
                    }

                    String webUrl = EnvConfig.get("WEB_URL");
                    String inviteCode = UUID.randomUUID().toString().substring(0, 8);
                    String inviteLink = webUrl + "/" + groupId + "?code=" + inviteCode;
                    long expireTime = System.currentTimeMillis() + (24 * 60 * 60 * 1000);
                    dbService.getGroupService().getInviteCodes().storeInviteCode(groupId, inviteCode, userId);
                    
                    res.put("userId", userId);
                    res.put("inviteLink", inviteLink);
                    res.put("inviteCode", inviteCode);
                    res.put("groupId", groupId);
                    res.put("expiresAt", expireTime);
                } catch(Exception err) {
                    err.printStackTrace();
                    Map<String, Object> errRes = new HashMap<>();
                    errRes.put("error", "LINK_FAILED");
                    errRes.put("message", err.getMessage());
                    socketMethods.send(sessionId, "/queue/invite-link-err", errRes);

                    res.put("status", "error");
                    res.put("error", err.getMessage());
                }

                return res;
            },
            "/queue/invite-link-scss",
            false
        ));

        return configs;
    }
}
