package com.app.main.root.app._data;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.Arrays;
import java.util.Collections;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;
import org.springframework.stereotype.Component;

import com.app.main.root.EnvConfig;
import com.app.main.root.app.EventTracker;
import com.app.main.root.app.EventLog.EventDirection;
import com.app.main.root.app._db.DbService;
import com.app.main.root.app._server.ConnectionTracker;
import com.app.main.root.app._server.ConnectionInfo;
import com.app.main.root.app.main._messages_config.MessageLog;
import com.app.main.root.app.main._messages_config.MessageTracker;

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
                String username = (String) payload;
                long time = System.currentTimeMillis();

                eventTracker.track(
                    "new-user",
                    username,
                    EventDirection.RECEIVED,
                    sessionId,
                    username
                );
                connectionTracker.updateUsername(sessionId, username);

                try {
                    dbService.getUserService().addUser(sessionId, username);
                    ConnectionInfo connectionInfo = connectionTracker.getConnection(sessionId);
                    if(connectionInfo != null) connectionTracker.logUsernameSet(connectionInfo, username);
                } catch(Exception err) {
                    System.out.println("Failed to add user: " + err.getMessage());
                }

                Map<String, Object> updateMessage = new HashMap<>();
                updateMessage.put("type", "USER_JOINED");
                updateMessage.put("username", username);
                updateMessage.put("sessionId", sessionId);
                updateMessage.put("timestamp", time);
                return updateMessage;
            },
            "/topic/users",
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
                    String creator = (String) groupData.get("creator");
                    String creatorId = (String) groupData.get("creatorId");
                    String groupName = (String) groupData.get("groupName");
                    String creationDate = LocalDateTime.now().format(DateTimeFormatter.ISO_LOCAL_DATE_TIME);
                    String format = UUID.randomUUID().toString().substring(0, 7);
                    String id = "group_" + System.currentTimeMillis() + "_" + format;

                    Map<String, Object> newGroup = new HashMap<>();
                    newGroup.put("id", id);
                    newGroup.put("name", groupName);
                    newGroup.put("creator", creator);
                    newGroup.put("creatorId", creatorId);
                    newGroup.put("members", Arrays.asList(creator));
                    newGroup.put("createdAt", creationDate);

                    eventTracker.track(
                        "create-group", 
                        newGroup, 
                        EventDirection.RECEIVED, 
                        sessionId, 
                        creator
                    );

                    dbService.getGroupService().createGroup(sessionId, groupName, creatorId);
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
                    long time = System.currentTimeMillis();
                    Map<String, Object> data = (Map<String, Object>) payload;
                    String groupId = (String) data.get("groupId");
                    String username = socketMethods.getSocketUsername(sessionId);
                    if(groupId == null || username == null) throw new Exception("Group Id and username required!");

                    boolean success = dbService.getGroupService().addUserToGroup(groupId, username, sessionId);
                    if(!success) throw new Exception("Failed to join group :(");

                    Map<String, Object> groupInfo = dbService.getGroupService().getGroupInfo(groupId);
                    eventTracker.track(
                        "join-group",
                        data,
                        EventDirection.RECEIVED,
                        sessionId,
                        username
                    );

                    Map<String, Object> res = new HashMap<>();
                    res.put("groupId", groupId);
                    res.put("groupName", groupInfo.get("name"));
                    res.put("username", username);
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
                try {
                    Map<String, Object> reqData = (Map<String, Object>) payload;
                    String groupId = (String) reqData.get("groupId");
                    String username = socketMethods.getSocketUsername(sessionId);

                    boolean isMember = dbService.getGroupService().isUserGroupMember(groupId, username);
                    if(!isMember) throw new Exception("Invite link err");

                    String webUrl = EnvConfig.get("WEB_URL");
                    String inviteCode = UUID.randomUUID().toString().substring(0, 8);
                    String inviteLink = webUrl + groupId + "?code=" + inviteCode;
                    long expireTime = System.currentTimeMillis() + (24 * 60 * 60 * 1000);
                    dbService.getGroupService().storeInviteCode(groupId, inviteCode, username);

                    Map<String, Object> res = new HashMap<>();
                    res.put("inviteLink", inviteLink);
                    res.put("inviteCode", inviteCode);
                    res.put("groupId", groupId);
                    res.put("expiresAt", expireTime);
                    return res;
                } catch(Exception err) {
                    Map<String, Object> errRes = new HashMap<>();
                    errRes.put("error", "LINK_FAILED");
                    errRes.put("message", err.getMessage());
                    socketMethods.send(sessionId, "/queue/invite-link-err", errRes);
                    return Collections.emptyList();
                }
            },
            "/queue/invite-link-scss",
            false
        ));

        return configs;
    }
}
