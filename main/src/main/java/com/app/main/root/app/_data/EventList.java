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
                    serviceManager.getUserService().addUser(userId, username, sessionId);
                    ConnectionInfo connectionInfo = connectionTracker.getConnection(sessionId);
                    if(connectionInfo != null) connectionTracker.logUsernameSet(connectionInfo, username);
                    serviceManager.getUserService().linkUserSession(userId, sessionId);
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
        /* User Id */
        configs.put("get-user-id", new EventConfig(
            (sessionId, payload, headerAccessor) -> {
                long time = System.currentTimeMillis();
                String userId = serviceManager.getUserService().getUserIdBySession(sessionId);

                eventTracker.track(
                    "get-user-id",
                    payload,
                    EventDirection.RECEIVED,
                    sessionId,
                    sessionId
                );

                Map<String, Object> res = new HashMap<>();
                res.put("userId", userId);
                res.put("timestamp", time);
                res.put("status", "success");
                return res;
            },
            "/queue/user-id",
            false
        ));
        /* Get Username */
        configs.put("get-username", new EventConfig(
            (sessionId, payload, headerAccessor) -> {
                long time = System.currentTimeMillis();
                String username = serviceManager.getUserService().getUsernameBySessionId(sessionId);

                eventTracker.track(
                    "get-username",
                    payload,
                    EventDirection.RECEIVED,
                    sessionId,
                    sessionId
                );

                Map<String, Object> res = new HashMap<>();
                res.put("username", username);
                res.put("timestamp", time);
                res.put("status", "success");
                return res;
            },
            "/queue/username",
            false
        ));
        /* Send Contact Request */
        configs.put("send-contact-request", new EventConfig(
            (sessionId, payload, headerAccessor) -> {
                try {
                    Map<String, Object> data = (Map<String, Object>) payload;
                    String fromUserId = serviceManager.getUserService().getUserIdBySession(sessionId);
                    String toUsername = (String) data.get("username");

                    Map<String, Object> res = serviceManager.getContactService()
                        .sendContactRequest(fromUserId, toUsername);

                    eventTracker.track(
                        "send-contact-request",
                        res,
                        EventDirection.RECEIVED,
                        sessionId,
                        fromUserId
                    );
                    return res;
                } catch(Exception err) {
                    Map<String, Object> error = new HashMap<>();
                    error.put("error", "CONTACT_REQUEST_FAILED");
                    error.put("message", err.getMessage());
                    socketMethods.send(sessionId, "/queue/contact-request-err", error);
                    return Collections.emptyMap();
                }
            },
            "/queue/contact-request-scss",
            false
        ));
        /* Response Contact Request */
        configs.put("response-contact-request", new EventConfig(
            (sessionId, payload, headerAccessor) -> {
                try {
                    Map<String, Object> data = (Map<String, Object>) payload;
                    String requestId = (String) data.get("requestId");
                    boolean accept = (Boolean) data.get("accept");
                    String userId = serviceManager.getUserService().getUserIdBySession(sessionId);

                    Map<String, Object> res = serviceManager.getContactService()
                        .responseContactRequest(requestId, userId, accept);

                    eventTracker.track(
                        "response-contact-request",
                        res,
                        EventDirection.RECEIVED,
                        sessionId,
                        userId
                    );

                    return res;
                } catch(Exception err) {
                    Map<String, Object> error = new HashMap<>();
                    error.put("error", "CONTACT_RESPONSE_FAILED");
                    error.put("message", err.getMessage());
                    socketMethods.send(sessionId, "/queue/contact-response-err", error);
                    return Collections.emptyMap();
                }
            },
            "/queue/contact-response-scss",
                false
        ));
        /* Get Contacts */
        configs.put("get-contacts", new EventConfig(
            (sessionId, payload, headerAccessor) -> {
                try {
                    String userId = serviceManager.getUserService().getUserIdBySession(sessionId);
                    List<Map<String, Object>> contacts = serviceManager.getContactService().getContacts(userId);

                    Map<String, Object> res = new HashMap<>();
                    res.put("contacts", contacts);
                    res.put("count", contacts.size());

                    eventTracker.track(
                        "get-contacts",
                        res,
                        EventDirection.RECEIVED,
                        sessionId,
                        userId
                    );

                    return res;
                } catch(Exception err) {
                    Map<String, Object> error = new HashMap<>();
                    error.put("error", "LOAD_CONTACTS_FAILED");
                    error.put("message", err.getMessage());
                    socketMethods.send(sessionId, "/queue/contacts-err", error);
                    return Collections.emptyMap();
                }
            },
            "/queue/contacts-scss",
            false
        ));
        /* Get Pending Contacts */
        configs.put("get-pending-requests", new EventConfig(
            (sessionId, payload, headerAccessor) -> {
                try {
                    String userId = serviceManager.getUserService().getUserIdBySession(sessionId);
                    List<Map<String, Object>> requests = serviceManager.getContactService()
                        .getPendingContactRequests(userId);

                    Map<String, Object> res = new HashMap<>();
                    res.put("requests", requests);
                    res.put("count", requests.size());

                    eventTracker.track(
                        "get-pending-requests",
                        res,
                        EventDirection.RECEIVED,
                        sessionId,
                        userId
                    );

                    return res;
                } catch(Exception err) {
                    Map<String, Object> error = new HashMap<>();
                    error.put("error", "LOAD_PENDING_REQUESTS_FAILED");
                    error.put("message", err.getMessage());
                    socketMethods.send(sessionId, "/queue/pending-requests-err", error);
                    return Collections.emptyMap();
                }
            },
            "/queue/pending-requests-scss",
            false
        ));
        /* Remove Contact */
        configs.put("remove-contact", new EventConfig(
            (sessionId, payload, headerAccessor) -> {
                try {
                    Map<String, Object> data = (Map<String, Object>) payload;
                    String userId = serviceManager.getUserService().getUserIdBySession(sessionId);
                    String contactId = (String) data.get("contactId");
                    boolean success = serviceManager.getContactService().removeContact(userId, contactId);

                    Map<String, Object> res = new HashMap<>();
                    res.put("success", success);
                    res.put("contactId", contactId);

                    eventTracker.track(
                        "remove-contact",
                        res,
                        EventDirection.RECEIVED,
                        sessionId,
                        userId
                    );

                    return res;
                } catch(Exception err) {
                    Map<String, Object> error = new HashMap<>();
                    error.put("error", "REMOVE_CONTACT_FAILED");
                    error.put("message", err.getMessage());
                    socketMethods.send(sessionId, "/queue/remove-contact-err", error);
                    return Collections.emptyMap();
                }
            },
            "/queue/remove-contact-scss",
            false
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
                    String chatId = (String) payloadData.get("chatId");
                    String recipientId = (String) payloadData.get("recipientId");
                    String currentUserId = serviceManager.getUserService().getUserIdBySession(sessionId);

                    String routeType = messageAnalyzer.extractRouteType(sessionId, payloadData);
                    if(chatId != null && chatId.startsWith("direct_")) {
                        String destination = "/user/queue/messages/direct/" + chatId;
                        Object data = serviceManager.getMessageService().payload(
                            routeType, 
                            payloadData, 
                            chatId, 
                            sessionId, 
                            currentUserId
                        );
                        socketMethods.send(sessionId, destination, data);

                        String recipientSession = serviceManager.getUserService().getSessionByUserId(recipientId);
                        if(recipientSession != null) {
                            Object recipientData = serviceManager.getMessageService().payload(
                                routeType, 
                                payloadData, 
                                chatId, 
                                sessionId, 
                                currentUserId
                            );
                            socketMethods.send(recipientSession, destination, recipientData);
                        }
                    }

                    return Collections.emptyMap();
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
            "",
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
                    String currentUserId = serviceManager.getUserService().getUserIdBySession(sessionId);
                    String routeType = messageAnalyzer.extractRouteType(sessionId, payloadData);
                    Map<String, Object> messageWithPerspective = messageAnalyzer.applyPerspective(sessionId, payloadData);

                    if(actualGroupId != null && actualGroupId.startsWith("group_")) {
                        String destination = "/user/queue/messages/group/" + actualGroupId;
                        Object data = serviceManager.getMessageService().payload(
                            routeType, 
                            messageWithPerspective, 
                            actualGroupId, 
                            sessionId,
                            currentUserId
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

                    Map<String, Object> creationResult = serviceManager.getGroupService()
                        .createGroup(id, groupName, creatorId, creator, sessionId);

                    Map<String, Object> newGroup = new HashMap<>();
                    newGroup.put("id", id);
                    newGroup.put("chatId", id);
                    newGroup.put("groupId", id);
                    newGroup.put("name", groupName);
                    newGroup.put("creator", creator);
                    newGroup.put("creatorId", creatorId);
                    newGroup.put("members", creationResult.get("members"));
                    newGroup.put("createdAt", creationDate);
                    newGroup.put("sessionId", sessionId);
                    newGroup.put("verificationResult", creationResult.get("verificationStatus"));

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
                    serviceManager.getGroupService().sendCreationMessage(
                        sessionId, 
                        id, 
                        groupName, 
                        creator
                    );
                    
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

                    boolean success = serviceManager.getGroupService().addUserToGroup(groupId, userId, username);
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
                            Map<String, Object> systemMessage = serviceManager.getSystemMessageService().createAndSaveMessage(
                                "USER_JOINED_GROUP", 
                                data, 
                                sessionId, 
                                memberSessionId,
                                groupId
                            );
                            systemMessage.put("groupId", groupId);
                            systemMessage.put("chatId", groupId);
                            systemMessage.put("chatType", "GROUP");
                            data.put("userId", userId);
                            data.put("username", username);
                            data.put("targetSessionid", memberSessionId);
                            data.put("isAboutCurrentUser", memberSessionId.equals(sessionId));
                            
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
        /* Exit User */
        configs.put("exit-group", new EventConfig(
            (sessionId, payload, headerAccessor) -> {
                try {
                    long time = System.currentTimeMillis();
                    Map<String, Object> data = serviceManager.getGroupService().parseData(payload);
                    String userId = serviceManager.getUserService().getUserIdBySession(sessionId);
                    String username = (String) data.get("username");
                    String groupId = (String) data.get("groupId");
                    String groupName = (String) data.get("groupName");

                    boolean success = serviceManager.getGroupService().removeUserFromGroup(groupId, userId);
                    if(!success) throw new Exception("Failed to exit group");
                    serviceManager.getGroupService().removeUserFromGroupMapping(userId, groupId);
                    List<_User> groupMembers = serviceManager.getGroupService().getGroupMembers(groupId);
                    
                    eventTracker.track(
                        "exit-group", 
                        data, 
                        EventDirection.RECEIVED, 
                        sessionId, 
                        username
                    );

                    
                    /* Event Response */
                    Map<String, Object> res = new HashMap<>();
                    res.put("id", groupId);
                    res.put("name", groupName);
                    res.put("userId", userId);
                    res.put("joined", true);
                    res.put("timestamp", time);
                    res.put("sessionId", sessionId);
                    serviceManager.getUserService().sendMessageToUser(sessionId, "exit-group-scss", res);

                    /* System Message */
                    for(_User member : groupMembers) {
                        String memberSessionId = serviceManager.getUserService().getSessionByUserId(member.getId());
                        if(memberSessionId != null) {
                            Map<String, Object> systemMessage = serviceManager.getSystemMessageService().createAndSaveMessage(
                                "USER_LEFT_GROUP", 
                                data, 
                                sessionId, 
                                memberSessionId,
                                groupId
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
                    errRes.put("error", "EXIT_FAILED");
                    errRes.put("message", err.getMessage());
                    serviceManager.getUserService().sendMessageToUser(sessionId, "exit-group-err", errRes);
                    return Collections.emptyMap();
                }
            },
            "/user/queue/exit-group-scss",
            false
        ));
        /* Get User Groups */
        configs.put("get-user-chats", new EventConfig(
            (sessionId, payload, headerAccessor) -> {
                try {
                    Map<String, Object> data = (Map<String, Object>) payload;
                    String userId = (String) data.get("userId");
                    if(userId == null || userId.trim().isEmpty()) {
                        throw new IllegalArgumentException("User ID is required!");
                    }

                    List<Map<String, Object>> userChats = serviceManager
                        .getChatManagerService()
                        .getChats(userId);
                        
                    Map<String, Object> res = new HashMap<>();
                    res.put("userId", userId);
                    res.put("chats", userChats);
                    res.put("count", userChats.size());
                    res.put("status", "success");

                    eventTracker.track(
                        "get-user-chats",
                        Map.of("userId", userId, "chatCount", userChats.size()),
                        EventDirection.RECEIVED,
                        sessionId,
                        userId
                    );

                    return res;
                } catch(Exception err) {
                    err.getStackTrace();
                    Map<String, Object> errRes = new HashMap<>();
                    errRes.put("error", "LOAD_CHATS_FAILED");
                    errRes.put("message", err.getMessage());
                    socketMethods.send(sessionId, "/queue/user-chats-err", errRes);
                    return Collections.emptyMap();
                }
            },
            "/queue/user-chats-scss",
            false
        ));
        configs.put("get-direct-chat-id", new EventConfig(
            (sessionId, payload, headerAccessor) -> {
                try {
                    Map<String, Object> data = (Map<String, Object>) payload;
                    String currentUserId = serviceManager.getUserService().getUserIdBySession(sessionId);
                    String contactId = (String) data.get("contactId");

                    Map<String, Object> res = serviceManager.getDirectService()
                        .getChatId(currentUserId, contactId);
                        
                    eventTracker.track(
                        "get-direct-chat-id",
                        res,
                        EventDirection.RECEIVED,
                        sessionId,
                        currentUserId
                    );

                    return res;
                } catch(Exception err) {
                    err.getStackTrace();
                    Map<String, Object> errRes = new HashMap<>();
                    errRes.put("error", "CHAT_ID_GENERATION_FAILED");
                    errRes.put("message", err.getMessage());
                    socketMethods.send(sessionId, "/queue/direct-chat-id-err", errRes);
                    return Collections.emptyMap();
                }
            },
            "/queue/direct-chat-id-scss",
            false
        ));
        /* Generate Group Link */
        configs.put("generate-invite-link", new EventConfig(
            (sessionId, payload, headerAccessor) -> {
                Map<String, Object> res = new HashMap<>();

                try {
                    Map<String, Object> data = (Map<String, Object>) payload;
                    String groupId = (String) data.get("groupId");
                    String userId = serviceManager.getUserService().getUserIdBySession(sessionId);
                    boolean isMember = serviceManager.getGroupService().isUserGroupMember(groupId, userId);
                    if(!isMember) throw new Exception("User: " + userId + "is not a member!");

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