package com.app.main.root.app._data;
import com.app.main.root.app.EventTracker;
import com.app.main.root.app._db.DbService;
import com.app.main.root.app.main._messages_config.MessageLog;
import com.app.main.root.app.main._messages_config.MessageTracker;
import com.app.main.root.app.EventLog.EventDirection;
import com.app.main.root.app._server.EventRegistry;
import com.app.main.root.app._server.ConnectionTracker;
import org.springframework.stereotype.Component;
import java.time.format.DateTimeFormatter;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import java.time.LocalDateTime;
import java.util.*;

@Component
public class ConfigSocketEvents {
    private final EventTracker eventTracker;
    private final MessageTracker messageTracker;
    private final ConnectionTracker connectionTracker;
    private final DbService dbService;
    private final SocketMethods socketMethods;
    private final SimpMessagingTemplate messagingTemplate;

    public ConfigSocketEvents(
        EventTracker eventTracker,
        MessageTracker messageTracker,
        ConnectionTracker connectionTracker,
        DbService dbService,
        SocketMethods socketMethods,
        SimpMessagingTemplate messagingTemplate
    ) {
        this.eventTracker = eventTracker;
        this.messageTracker = messageTracker;
        this.connectionTracker = connectionTracker;
        this.dbService = dbService;
        this.socketMethods = socketMethods;
        this.messagingTemplate = messagingTemplate;
    }

    public void configSocketEvents() {
        List<EventRegistry.EventHandlerConfig> events = Arrays.asList(
            //New User Event
            EventRegistry.createBroadcastEvent(
                "new-user",
                (sessionId, data, messagingTemplate) -> {
                    String users = (String) data;
                    long time = System.currentTimeMillis();

                    eventTracker.track(
                        "new-user", 
                        users,
                        EventDirection.RECEIVED,
                        sessionId,
                        users
                    );
                    connectionTracker.updateUsername(sessionId, users);

                    try {
                        dbService.getUserService().addUser(sessionId, users);
                        ConnectionTracker.ConnectionInfo connectionInfo = connectionTracker.getConnection(sessionId);
                        if(connectionInfo != null) connectionTracker.logUsernameSet(connectionInfo, users);
                    } catch(Exception err) {
                        System.err.println("Failed to add user: " + err.getMessage());
                    }

                    Map<String, Object> updateMessage = new HashMap<>();
                    updateMessage.put("type", "USER_JOINED");
                    updateMessage.put("username", users);
                    updateMessage.put("sessionId", sessionId);
                    updateMessage.put("timestamp", time);

                    socketMethods.broadcast(users, updateMessage);
                    return updateMessage;
                },
                "/topic/users",
                true
            ),
            //Exit User Event
            EventRegistry.createBroadcastEvent(
                "exit-user",
                (sessionId, data, messagingTemplate) -> {
                    String user = (String) data;
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

                    socketMethods.broadcast(sessionId, updateMessage);
                    return user + " left";
                },
                "/topic/users",
                true
            ),
            //Chat Event
            EventRegistry.createBroadcastEvent(
                "chat",
                (sessionId, data, messagingTemplate) -> {
                    Map<String, Object> messageData = (Map<String, Object>) data;
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
                    res.put("content", content);
                    res.put("senderId", sessionId);
                    res.put("chatId", chatSocket);
                    res.put("messageId", messageId);
                    res.put("timestamp", time);

                    socketMethods.send(sessionId, content, data);
                    socketMethods.broadcast(content, data);
                    return res;
                },
                "/topic/chat",
                true
            ),
            //Create Group
            EventRegistry.createBroadcastEvent(
                "create-group",
                (sessionId, data, messagingTemplate) -> {
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
                        
                        socketMethods.send(messagingTemplate, sessionId, data);
                        return newGroup;
                    } catch(Exception err) {
                        socketMethods.send(messagingTemplate, sessionId, err.getMessage());
                        return Collections.emptyMap();
                    }
                },
                "/queue/groups",
                false
            ),
            //Socket Id
            EventRegistry.createBroadcastEvent(
                "get-socket-id",
                (sessionId, data, messagingTemplate) -> {
                    long time = System.currentTimeMillis();

                    eventTracker.track(
                        "get-socket-id",
                        data,
                        EventDirection.RECEIVED,
                        sessionId,
                        sessionId
                    );
                    socketMethods.send(
                        messagingTemplate, 
                        sessionId, 
                        data
                    );
                    
                    Map<String, Object> res = new HashMap<>();
                    res.put("socketId", sessionId);
                    res.put("timestamp", time);
                    res.put("status", "success");
                    return res;
                },
                "/queue/socket-id",
                false
            )
        );
        EventRegistry.registerAllEvents(events);
    }
}