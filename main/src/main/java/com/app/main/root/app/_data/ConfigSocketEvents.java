package com.app.main.root.app._data;
import com.app.main.root.app.EventTracker;
import com.app.main.root.app.EventLog.EventDirection;
import com.app.main.root.app._server.EventRegistry;
import com.app.main.root.app._server.ConnectionTracker;
import org.springframework.stereotype.Component;
import com.app.main.root.app._db.DbService;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.*;

@Component
public class ConfigSocketEvents {
    private final EventTracker eventTracker;
    private final ConnectionTracker connectionTracker;
    private final DbService dbService;
    private final SocketMethods socketMethods;

    public ConfigSocketEvents(
        EventTracker eventTracker,
        ConnectionTracker connectionTracker,
        DbService dbService,
        SocketMethods socketMethods
    ) {
        this.eventTracker = eventTracker;
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

                    eventTracker.track(
                        "new-user", 
                        user,
                        EventDirection.RECEIVED,
                        sessionId,
                        user
                    );
                    connectionTracker.updateUsername(sessionId, user);

                    try {
                        dbService.getUserService().addUser(sessionId, user);
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
    
                    eventTracker.track(
                        "exit-user",
                        user,
                        EventDirection.RECEIVED,
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
    
                    eventTracker.track(
                        "chat",
                        data,
                        EventDirection.RECEIVED,
                        sessionId,
                        content
                    );
    
                    try {
                        dbService.getMessageService().saveMessage(sessionId, chatSocket, content, "text");
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
            //Create Group
            EventRegistry.createBroadcastEvent(
                "create-group",
                (socket, data, io) -> {
                    String sessionId = socketMethods.getSessionId(socket);
                    
                    try {
                        Map<String, Object> groupData = dbService.getGroupService().parseData(data);
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
                        socketMethods.send(
                            socket, 
                            "group-creation-scss", 
                            newGroup
                        );
                        
                        return Collections.emptyMap();
                    } catch(Exception err) {
                        socketMethods.send(socket, "group-creation-err", 
                            Map.of("error", err.getMessage())
                        );
                        return Collections.emptyMap();
                    }
                },
                false,
                ""
            ),
            //Group Created
            EventRegistry.createBroadcastEvent(
                "group-created",
                (socket, data, io) -> {
                    String sessionId = socketMethods.getSessionId(socket);

                    eventTracker.track(
                        "group-created",
                        data,
                        EventDirection.RECEIVED,
                        sessionId,
                        sessionId
                    );

                    EventRegistry.removeEvent("group-creation-scss");

                    return Collections.emptyMap();
                },
                false,
                "create-group"
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
                    
                    eventTracker.track(
                        "get-socket-id",
                        data,
                        EventDirection.RECEIVED,
                        sessionId,
                        sessionId
                    );
                    socketMethods.send(
                        socket,
                        "res-socket-id",
                        sessionId
                    );

                    return sessionId;
                },
                true,
                ""
            )
        );
        EventRegistry.registerAllEvents(events);
    }
}