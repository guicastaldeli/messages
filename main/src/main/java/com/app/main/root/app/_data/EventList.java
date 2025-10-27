package com.app.main.root.app._data;
import com.app.main.root.app._server.MessageRouter;
import com.app.main.root.app._service.ServiceManager;
import com.app.main.root.EnvConfig;
import com.app.main.root.app.EventTracker;
import com.app.main.root.app.EventLog.EventDirection;
import com.app.main.root.app._server.ConnectionTracker;
import com.app.main.root.app._types._User;
import com.app.main.root.app._server.ConnectionInfo;
import com.app.main.root.app.main._messages_config.MessageTracker;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Component;
import java.time.format.DateTimeFormatter;
import java.time.LocalDateTime;
import java.util.*;

@Component
public class EventList {
    private final ServiceManager serviceManager;
    private final EventTracker eventTracker;
    private final ConnectionTracker connectionTracker;
    private final SocketMethods socketMethods;
    private final MessageTracker messageTracker;
    private final MessageRouter messageRouter;
    private final MessageAnalyzer messageAnalyzer;
    private final SimpMessagingTemplate messagingTemplate;

    public EventList(
        ServiceManager serviceManager,
        EventTracker eventTracker,
        SimpMessagingTemplate messagingTemplate,
        ConnectionTracker connectionTracker,
        SocketMethods socketMethods,
        MessageTracker messageTracker,
        MessageRouter messageRouter,
        MessageAnalyzer messageAnalyzer
    ) {
        this.eventTracker = eventTracker;
        this.serviceManager = serviceManager;
        this.messagingTemplate = messagingTemplate;
        this.connectionTracker = connectionTracker;
        this.socketMethods = socketMethods;
        this.messageTracker = messageTracker;
        this.messageRouter = messageRouter;
        this.messageAnalyzer = messageAnalyzer;
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
                    serviceManager.getUserService().addUser(actualUserId, username, sessionId);
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
                try {
                    Map<String, Object> payloadData = (Map<String, Object>) payload;
                    messageAnalyzer.organizeAndRoute(sessionId, payloadData);
                    eventTracker.track(
                        "chat",
                        payloadData,
                        EventDirection.RECEIVED,
                        sessionId,
                        "client"
                    );
                } catch(Exception err) {
                    eventTracker.track(
                        "chat-error",
                        Map.of("error", err.getMessage(), "payload", payload),
                        EventDirection.RECEIVED,
                        sessionId,
                        "client"
                    );
                }

                return Collections.emptyMap();
            },
            "/queue/messages",
            false
        ));
        configs.put("direct", new EventConfig(
            (sessionId, payload, headerAcessor) -> {
                try {
                    Map<String, Object> payloadData = (Map<String, Object>) payload;
                    messageAnalyzer.organizeAndRoute(sessionId, payloadData);
                    eventTracker.track(
                        "DIRECT_MESSAGE",
                        payloadData,
                        EventDirection.RECEIVED,
                        sessionId,
                        "client"
                    );
                } catch(Exception err) {
                    eventTracker.track(
                        "DIRECT_MESSAGE_ERR",
                        Map.of("error", err.getMessage(), "payload", payload),
                        EventDirection.RECEIVED,
                        sessionId,
                        "client"
                    );
                }

                return Collections.emptyMap();
            },
            "/user/queue/messages/direct",
            false
        ));
        configs.put("group", new EventConfig(
            (sessionId, payload, headerAcessor) -> {
                try {
                    Map<String, Object> payloadData = (Map<String, Object>) payload;
                    messageAnalyzer.organizeAndRoute(sessionId, payloadData);
                    eventTracker.track(
                        "GROUP_MESSAGE",
                        payloadData,
                        EventDirection.RECEIVED,
                        sessionId,
                        "client"
                    );
                    String chatId = (String) payloadData.get("chatId");
                    String groupId = (String) payloadData.get("groupId");
                    String actualGroupId = chatId != null ? chatId : groupId;
                    String routeType = messageAnalyzer.extractRouteType(sessionId, payloadData);

                    if(actualGroupId != null && actualGroupId.startsWith("group_")) {
                        String destination = "/user/queue/messages/group/" + actualGroupId;
                        Object data = serviceManager.getMessageService().payload(
                            routeType, 
                            payloadData, 
                            actualGroupId, 
                            sessionId
                        );
                        socketMethods.send(sessionId, destination, data);
                    }
                } catch(Exception err) {
                    eventTracker.track(
                        "GROUP_MESSAGE_ERR",
                        Map.of("error", err.getMessage(), "payload", payload),
                        EventDirection.RECEIVED,
                        sessionId,
                        "client"
                    );
                }

                return Collections.emptyMap();
            },
            "",
            false
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
                    Map<String, Object> groupData = serviceManager.getGroupService().parseData(payload);
                    String format = UUID.randomUUID().toString().substring(0, 7);
                    String id = "group_" + System.currentTimeMillis() + "_" + format;
                    String creator = (String) groupData.get("creator");
                    String creatorId = (String) groupData.get("creatorId");
                    String groupName = (String) groupData.get("groupName");
                    String creationDate = LocalDateTime.now().format(DateTimeFormatter.ISO_LOCAL_DATE_TIME);

                    serviceManager.getGroupService().createGroup(id, groupName, creatorId);
                    serviceManager.getGroupService().addUserToGroup(id, creatorId);
                    serviceManager.getGroupService().addUserToGroupMapping(creatorId, id, sessionId);

                    List<_User> members = serviceManager.getGroupService().getGroupMembers(id);
                    List<String> memberUserId = new ArrayList<>();
                    for(_User member : members) memberUserId.add(member.getId());

                    Map<String, Object> newGroup = new HashMap<>();
                    newGroup.put("id", id);
                    newGroup.put("chatId", id);
                    newGroup.put("groupId", id);
                    newGroup.put("name", groupName);
                    newGroup.put("creator", creator);
                    newGroup.put("creatorId", creatorId);
                    newGroup.put("members", memberUserId != null ? memberUserId : creatorId);
                    newGroup.put("createdAt", creationDate);
                    newGroup.put("sessionId", sessionId);

                    eventTracker.track(
                        "create-group", 
                        newGroup, 
                        EventDirection.RECEIVED, 
                        sessionId, 
                        creator
                    );
                    serviceManager.getUserService().sendMessageToUser(
                        sessionId,
                        "group-creation-scss",
                        newGroup
                    );

                    /* System Message */
                    new Thread(new Runnable() {
                        @Override
                        public void run() {
                            try {
                                Thread.sleep(300);
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
                                Map<String, Object> systemMessage = serviceManager.getSystemMessageService().createMessageWithPerspective(
                                    "GROUP_CREATED", 
                                    systemMessageData, 
                                    sessionId, 
                                    sessionId
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
                    
                    return Collections.emptyMap();
                } catch(Exception err) {
                    serviceManager.getUserService().sendMessageToUser(sessionId, "group-creation-err", err.getMessage());
                    return Collections.emptyMap();
                }
            },
            "/user/queue/group-creation-scss",
            false
        ));
        /* Join Group */
        configs.put("join-group", new EventConfig(
            (sessionId, payload, headerAccessor) -> {
                try {
                    long time = System.currentTimeMillis();
                    Map<String, Object> data = serviceManager.getGroupService().parseData(payload);
                    String userId = (String) data.get("userId");
                    String inviteCode = (String) data.get("inviteCode");
                    String username = (String) data.get("username");

                    String groupId = serviceManager.getGroupService().getInviteCodes().findGroupByCode(inviteCode);
                    Map<String, Object> groupInfo = serviceManager.getGroupService().getGroupInfo(groupId);
                    List<_User> groupMembers = serviceManager.getGroupService().getGroupMembers(groupId);
                    
                    if(groupId == null) throw new Exception("Group Id is required!");
                    if(userId == null) throw new Exception("User Id is required!");
                    if(username == null || username.trim().isEmpty()) throw new Exception("Username is required!");

                    boolean isValid = serviceManager.getGroupService().getInviteCodes().validateInviteCode(inviteCode);
                    if(!isValid) throw new Exception("Invalid invite code");

                    boolean success = serviceManager.getGroupService().addUserToGroup(groupId, sessionId);
                    if(!success) throw new Exception("Failed to join group :(");
                    serviceManager.getGroupService().addUserToGroupMapping(userId, groupId, sessionId);

                    eventTracker.track(
                        "join-group",
                        data,
                        EventDirection.RECEIVED,
                        sessionId,
                        userId
                    );

                    /* Event Response */
                    Map<String, Object> res = new HashMap<>();
                    res.put("id", groupId);
                    res.put("name", groupInfo.get("name"));
                    res.put("userId", userId);
                    res.put("joined", true);
                    res.put("timestamp", time);
                    res.put("members", groupInfo.get("members"));
                    res.put("sessionId", sessionId);
                    serviceManager.getUserService().sendMessageToUser(sessionId, "join-group-scss", res);

                    /* System Message */
                    for(_User member : groupMembers) {
                        String memberSessionId = serviceManager.getUserService().getSessionByUserId(member.getId());
                        if(memberSessionId != null) {
                            Map<String, Object> systemMessage = serviceManager.getSystemMessageService().createMessageWithPerspective(
                                "USER_JOINED_GROUP", 
                                data, 
                                sessionId, 
                                memberSessionId
                            );
                            systemMessage.put("groupId", groupId);
                            systemMessage.put("chatId", groupId);
                            systemMessage.put("chatType", "GROUP");

                            String destination = "/user/queue/messages/group/" + groupId;
                            socketMethods.send(sessionId, destination, systemMessage);
                            messageRouter.routeMessage(sessionId, payload, systemMessage, new String[]{"GROUP"});
                        }
                    }
                    return Collections.emptyMap();
                } catch(Exception err) {
                    err.printStackTrace();
                    Map<String, Object> errRes = new HashMap<>();
                    errRes.put("error", "JOIN_FAILED");
                    errRes.put("message", err.getMessage());
                    serviceManager.getUserService().sendMessageToUser(sessionId, "join-group-err", errRes);
                    return Collections.emptyMap();
                }
            },
            "/user/queue/join-group-scss",
            false
        ));
        /* Generate Group Link */
        configs.put("generate-invite-link", new EventConfig(
            (sessionId, payload, headerAccessor) -> {
                Map<String, Object> res = new HashMap<>();

                try {
                    Map<String, Object> data = (Map<String, Object>) payload;
                    String groupId = (String) data.get("groupId");
                    String userId = (String) data.get("userId");
                    boolean isMember = serviceManager.getGroupService().isUserGroupMember(groupId, userId);

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
                    String inviteCode = UUID.randomUUID().toString().substring(0, 16);
                    String inviteLink = webUrl + "/join?c=" + inviteCode;
                    long expireTime = System.currentTimeMillis() + (24 * 60 * 60 * 1000);
                    serviceManager.getGroupService().getInviteCodes().storeInviteCode(groupId, inviteCode, userId, userId);
                    
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
        /* Get Group Info */
        configs.put("get-group-info", new EventConfig(
            (sessionId, payload, headerAccessor) -> {
                try {
                    Map<String, Object> data = (Map<String, Object>) payload;
                    String inviteCode = (String) data.get("inviteCode");
                    String groupId = serviceManager.getGroupService().getInviteCodes().findGroupByCode(inviteCode);
                    Map<String, Object> groupInfo = serviceManager.getGroupService().getGroupInfo(groupId);
                    Object creator = groupInfo.get("creator") != null ? groupInfo.get("creator") : groupInfo.get("creatorId");
                    List<_User> members = serviceManager.getGroupService().getGroupMembers(groupId);
                    List<String> memberNames = new ArrayList<>();
                    List<String> memberIds = new ArrayList<>();
                    for(_User member : members) {
                        memberNames.add(member.getUsername());
                        memberIds.add(member.getId());
                    }
                    
                    if(inviteCode == null || inviteCode.trim().isEmpty()) throw new Exception("Invite code is required");
                    if(groupId == null) throw new Exception("Invalid or expired invite code");

                    Map<String, Object> res = new HashMap<>();
                    res.put("id", groupId);
                    res.put("name", groupInfo.get("name"));
                    res.put("creator", creator);
                    res.put("creatorId", groupInfo.get("creatorId"));
                    res.put("members", memberNames);
                    res.put("memberIds", memberIds);
                    res.put("member", members.size());
                    res.put("status", "success");

                    eventTracker.track(
                        "get-group-info",
                        data,
                        EventDirection.RECEIVED,
                        sessionId,
                        groupId
                    );

                    return res;
                } catch(Exception err) {
                    Map<String, Object> errRes = new HashMap<>();
                    errRes.put("error", "GROUP_INFO_FAILED");
                    errRes.put("message", err.getMessage());
                    socketMethods.send(sessionId, "/queue/group-info-err", errRes);
                    return Collections.emptyMap();
                }
            },
            "/queue/group-info-scss",
            false
        ));

        return configs;
    }
}