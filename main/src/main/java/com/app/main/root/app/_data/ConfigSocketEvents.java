package com.app.main.root.app._data;
import com.app.main.root.app.main._messages_config.MessageTracker;
import com.app.main.root.app.main._messages_config.MessageLog.MessageDirection;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.app.main.root.app._server.EventRegistry;
import com.app.main.root.app._server.ConnectionTracker;
import org.springframework.stereotype.Component;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import com.app.main.root.app._db.DbService;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.*;

@Component
public class ConfigSocketEvents {
    private final MessageTracker messageTracker;
    private final ConnectionTracker connectionTracker;
    private final DbService dbService;
    private final SocketMethods socketMethods;

    public ConfigSocketEvents(
        MessageTracker messageTracker,
        ConnectionTracker connectionTracker,
        DbService dbService,
        SocketMethods socketMethods
    ) {
        this.messageTracker = messageTracker;
        this.connectionTracker = connectionTracker;
        this.dbService = dbService;
        this.socketMethods = socketMethods;
    }

    public void configSocketEvents() {
        List<EventRegistry.EventHandlerConfig> events = Arrays.asList(
            //New User Event
            EventRegistry.createBroadcastEvent(
                "new-user",
                (socket, data, io) -> {
                    String user = (String) data;
                    String sessionId = socketMethods.getSessionId(socket);

                    messageTracker.trackMessage(
                        "new-user", 
                        user,
                        MessageDirection.RECEIVED,
                        sessionId,
                        user
                    );
                    connectionTracker.updateUsername(sessionId, user);

                    try {
                        dbService.getUsersConfig().addUser(sessionId, user);
                        ConnectionTracker.ConnectionInfo connectionInfo = connectionTracker.getConnection(sessionId);
                        if(connectionInfo != null) connectionTracker.logUsernameSet(connectionInfo, user);
                    } catch(Exception err) {
                        System.err.println("Failed to add user: " + err.getMessage());
                    }

                    socketMethods.setSocketUsername(socket, user);
                    return user + " joined";
                },
                false,
                "update"
            ),
            //Exit User Event
            EventRegistry.createBroadcastEvent(
                "exit-user",
                (socket, data, io) -> {
                    String user = (String) data;
                    String sessionId = socketMethods.getSessionId(socket);
    
                    messageTracker.trackMessage(
                        "exit-user",
                        user,
                        MessageDirection.RECEIVED,
                        sessionId,
                        user
                    );
                    socketMethods.setSocketUsername(socket, user);
                    return user + " left";
                },
                false,
                "update"
            ),
            //Chat Event
            EventRegistry.createBroadcastEvent(
                "chat",
                (socket, data, io) -> {
                    Map<String, Object> messageData = (Map<String, Object>) data;
                    String content = (String) messageData.get("content");
                    String chatId = (String) messageData.get("chatId");
                    String username = socketMethods.getSocketUsername(socket);
                    String sessionId = socketMethods.getSessionId(socket);
                    String chatSocket = chatId != null ? chatId : sessionId; 
    
                    messageTracker.trackMessage(
                        "chat",
                        data,
                        MessageDirection.RECEIVED,
                        sessionId,
                        content
                    );
    
                    try {
                        dbService.getMessagesConfig().saveMessage(sessionId, chatSocket, content, "text");
                    } catch(Exception err) {
                        System.err.println("Failed to save message: " + err.getMessage());
                    }
    
                    Map<String, Object> res = new HashMap<>();
                    res.put("username", username);
                    res.put("content", data);
                    res.put("senderId", sessionId);
                    res.put("chatId", chatSocket);
                    return res;
                },
                true,
                "chat"
            ),
            //Create Group Event
            new EventRegistry.EventHandlerConfig(
                "create-group",
                (socket, data, io) -> {
                    try {
                        Map<String, Object> groupData;

                        if(data instanceof Map) {
                            groupData = (Map<String, Object>) data;
                        } else if(data instanceof String) {
                            try {
                                ObjectMapper mapper = new ObjectMapper();
                                groupData = mapper.readValue((String) data, Map.class);
                            } catch(Exception err) {
                                System.out.println("DATATTTATATTATA::: " + data);
                                throw new IllegalArgumentException("Invalid format for group data");
                            }
                        } else {
                            throw new IllegalArgumentException("Group data must be a Map or JSON String");
                        }


                        String creator = (String) groupData.get("creator");
                        String creatorId = (String) groupData.get("creatorId");
                        String groupName = (String) groupData.get("groupName");
                        String sessionId = socketMethods.getSessionId(socket);
                        String creationDate = LocalDateTime.now().format(DateTimeFormatter.ISO_LOCAL_DATE_TIME);
                        String format = UUID.randomUUID().toString().substring(0, 7);
                        String id = "group_" + System.currentTimeMillis() + "_" + format;

                        Map<String, Object> newGroup = new HashMap<>();
                        newGroup.put("id", id);
                        newGroup.put("name", groupName);
                        newGroup.put("creator", creator);
                        newGroup.put("creatorId", creatorId);
                        newGroup.put("members", Arrays.asList(creatorId));
                        newGroup.put("createdAt", creationDate);

                        try {
                            dbService.getGroupsConfig().createGroup(id, groupName, creatorId);
                            dbService.getGroupsConfig().addUserToGroup(id, creatorId);
                        } catch(Exception err) {
                            System.err.println("Failed to save group: " + err.getMessage());
                            throw new RuntimeException("Database error: " + err.getMessage(), err);
                        }

                        if(io instanceof SimpMessagingTemplate) {
                            SimpMessagingTemplate messagingTemplate = (SimpMessagingTemplate) io;
                            String groupCreatedScssData = "/topic/group-created-scss";
                            messagingTemplate.convertAndSendToUser(sessionId, groupCreatedScssData, newGroup);
                        }

                        String groupUpdateData = "/group-update";
                        Map<String, Object> groupUpdate = new HashMap<>();
                        groupUpdate.put("type", "group-created");
                        groupUpdate.put("group", newGroup);
                        groupUpdate.put("creator", creator);

                        if(io instanceof SimpMessagingTemplate) {
                            SimpMessagingTemplate messagingTemplate = (SimpMessagingTemplate) io;
                            messagingTemplate.convertAndSend(groupUpdateData, groupUpdateData);
                        }

                        System.out.println("Group created successfully: " + newGroup);
                        return newGroup;
                    } catch(Exception err) {
                        System.err.println("Error creating group: " + err.getMessage());
                        err.printStackTrace();

                        String sessionId = socketMethods.getSessionId(socket);
                        if(io instanceof SimpMessagingTemplate) {
                            SimpMessagingTemplate messagingTemplate = (SimpMessagingTemplate) io;
                            Map<String, Object> errorRes = new HashMap<>();
                            errorRes.put("error", true);
                            errorRes.put("message", "Group creation failed: " + err.getMessage());
                            messagingTemplate.convertAndSendToUser(sessionId, "/topic/group-created-err", errorRes);
                        }
                        
                        throw new RuntimeException("Group creation failed", err);
                    }
                },
                false,
                false,
                null
            ),
            //Join Group Event
            EventRegistry.createBroadcastEvent(
                "join-group",
                (socket, data, io) -> {
                    Map<String, Object> joinData = (Map<String, Object>) data;
                    String groupId = (String) joinData.get("groupId");
                    String username = (String) joinData.get("username");
                    String sessionId = socketMethods.getSessionId(socket);

                    Map<String, Object> res = new HashMap<>();
                    res.put("groupId", groupId);
                    res.put("groupId", username);
                    res.put("groupId", sessionId);
                    res.put("groupId", groupId);
                    res.put("message", username + " joined");
                    return res;
                },
                true,
                "group-update"
            ),
            //Exit Group Event
            EventRegistry.createBroadcastEvent(
                "exit-group",
                (socket, data, io) -> {
                    Map<String, Object> exitData = (Map<String, Object>) data;
                    String groupId = (String) exitData.get("groupId");
                    String username = (String) exitData.get("username");

                    Map<String, Object> res = new HashMap<>();
                    res.put("groupId", groupId);
                    res.put("username", username);
                    res.put("message", username + " left");
                    return res;
                },
                false,
                "group-update"
            ),
            //New Message Event
            EventRegistry.createBroadcastEvent(
                "new-message",
                (socket, data, io) -> {
                    Map<String, Object> messageData = (Map<String, Object>) data;
                    String socketUsername = socketMethods.getSocketUsername(socket);
                    String sessionId = socketMethods.getSessionId(socket);
                    String timestamp = new Date().toString();
    
                    Map<String, Object> res = new HashMap<>();
                    res.put("chatId", messageData.get("chatId"));
                    res.put("content", messageData.get("content"));
                    res.put("sender", socketUsername);
                    res.put("senderId", sessionId);
                    res.put("timestamp", timestamp);
                    return res;
                },
                true,
                "new-message"
            ),
            //Socket Id
            EventRegistry.createBroadcastEvent(
                "get-socket-id",
                (socket, data, io) -> {
                    String sessionId = socketMethods.getSessionId(socket);
                    ConnectionTracker.ConnectionInfo connectionInfo = connectionTracker.getConnection(sessionId);
                    String connectedDate = connectionInfo != null ? 
                    connectionInfo.connectedAt.format(DateTimeFormatter.ISO_LOCAL_DATE_TIME) :
                    LocalDateTime.now().format(DateTimeFormatter.ISO_LOCAL_DATE_TIME);

                    System.out.println(sessionId);
                    Map<String, Object> res = new HashMap<>();
                    res.put("socketId", sessionId);
                    res.put("connectedAt", connectedDate);
                    return res;
                },
                true,
                "socket-id"
            )
        );
        EventRegistry.registerAllEvents(events);
    }
}