package com.app.main.root.app._data;
import com.app.main.root.app.EventTracker;
import com.app.main.root.app._db.DbService;
import com.app.main.root.app.main._messages_config.MessageLog;
import com.app.main.root.app.main._messages_config.MessageTracker;
import com.app.main.root.app.EventLog.EventDirection;
import com.app.main.root.app._server.EventRegistry;
import com.app.main.root.app._server.ConnectionTracker;
import org.springframework.context.ApplicationListener;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.messaging.simp.SimpMessageHeaderAccessor;
import org.springframework.messaging.simp.broker.BrokerAvailabilityEvent;
import org.springframework.messaging.simp.annotation.support.SimpAnnotationMethodMessageHandler;
import org.springframework.messaging.handler.invocation.AbstractMethodMessageHandler;
import org.springframework.messaging.Message;
import org.springframework.messaging.handler.invocation.InvocableHandlerMethod;
import org.springframework.stereotype.Component;
import org.springframework.util.ReflectionUtils;
import java.lang.reflect.Method;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

@Component
public class ConfigSocketEvents implements ApplicationListener<BrokerAvailabilityEvent> {
    public interface EventHandler {
        Object handle(
            String sessionId,
            Object payload,
            SimpMessageHeaderAccessor headerAccessor
        );
    }

    private final SimpAnnotationMethodMessageHandler messageHandler;
    private final EventRegistry eventRegistry;
    private final EventTracker eventTracker;
    private final MessageTracker messageTracker;
    private final ConnectionTracker connectionTracker;
    private final DbService dbService;
    private final SocketMethods socketMethods;
    private final Map<String, InvocableHandlerMethod> handlerMethods = new ConcurrentHashMap<>();

    public ConfigSocketEvents(
        SimpAnnotationMethodMessageHandler messageHandler,
        EventRegistry eventRegistry,
        EventTracker eventTracker,
        MessageTracker messageTracker,
        ConnectionTracker connectionTracker,
        DbService dbService,
        SocketMethods socketMethods
    ) {
        this.messageHandler = messageHandler;
        this.eventRegistry = eventRegistry;
        this.eventTracker = eventTracker;
        this.messageTracker = messageTracker;
        this.connectionTracker = connectionTracker;
        this.dbService = dbService;
        this.socketMethods = socketMethods;
    }

    @Override
    public void onApplicationEvent(BrokerAvailabilityEvent event) {
        if(event.isBrokerAvailable()) {
            System.out.println("Broker available, registering message handlers...");
            registerMessageHandler();
        }
    }

    /*
    * Register Message Handlers 
    */
    private void registerMessageHandler() {
        Map<String, EventConfig> eventConfigs = createEventConfigs();

        for(Map.Entry<String, EventConfig> entry : eventConfigs.entrySet()) {
            String eventName = entry.getKey();
            EventConfig config = entry.getValue();
            registerEventHandler(eventName, config);
            System.out.println("Dynamically Registered handler for: /app/" + eventName);
        }
        System.out.println("Total handlers registered: " + handlerMethods.size());
    }

    private Map<String, EventConfig> createEventConfigs() {
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
                socketMethods.send(sessionId, "socket-id", res);
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
                    ConnectionTracker.ConnectionInfo connectionInfo = connectionTracker.getConnection(sessionId);
                    if(connectionInfo != null) connectionTracker.logUsernameSet(connectionInfo, username);
                } catch(Exception err) {
                    System.out.println("Failed to add user: " + err.getMessage());
                }

                Map<String, Object> updateMessage = new HashMap<>();
                updateMessage.put("type", "USER_JOINED");
                updateMessage.put("username", username);
                updateMessage.put("sessionId", sessionId);
                updateMessage.put("timestamp", time);

                socketMethods.broadcast("users", updateMessage);
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

                socketMethods.broadcast("chat", response);
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
                
                eventTracker.track("exit-user", user, EventDirection.RECEIVED, sessionId, user);
                
                Map<String, Object> updateMessage = new HashMap<>();
                updateMessage.put("type", "USER_LEFT");
                updateMessage.put("username", user);
                updateMessage.put("sessionId", sessionId);
                updateMessage.put("timestamp", time);

                socketMethods.broadcast("users", updateMessage);
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

                    eventTracker.track("create-group", newGroup, EventDirection.RECEIVED, sessionId, creator);
                    socketMethods.send(sessionId, "group-created", newGroup);
                    return newGroup;
                } catch(Exception err) {
                    socketMethods.send(sessionId, "group-error", err.getMessage());
                    return Collections.emptyMap();
                }
            },
            "/queue/groups",
            false
        ));

        return configs;
    }

    private void registerEventHandler(String eventName, EventConfig config) {
        try {
            Method handlerMethod = ReflectionUtils.findMethod(
                ConfigSocketEvents.class,
                "handleEvent",
                Map.class,
                SimpMessageHeaderAccessor.class
            );

            InvocableHandlerMethod invocableHandler = new InvocableHandlerMethod(this, handlerMethod) {
                @Override
                public Object invoke(Message<?> message, Object... providedArgs) throws Exception {
                    EventContext context = new EventContext(eventName, config);
                    EventContextHolder.setContext(context);
                    return super.invoke(message, providedArgs);
                }
            };

            Method registerHandlerMethod = ReflectionUtils.findMethod(
                AbstractMethodMessageHandler.class,
                "registerHandlerMethod",
                Object.class,
                Method.class,
                String.class
            );
            registerHandlerMethod.setAccessible(true);
            ReflectionUtils.invokeMethod(
                registerHandlerMethod, 
                messageHandler, 
                this, 
                handlerMethod, 
                "/app/" + eventName
            );
            handlerMethods.put(eventName, invocableHandler);
        } catch(Exception err) {
            System.err.println("Failed to register handler for event: " + eventName);
            err.printStackTrace();
        }
    }

    @MessageMapping
    public void handleEvent(
        @Payload Map<String, Object> payload,
        SimpMessageHeaderAccessor headerAccessor
    ) {
        EventContext context = EventContextHolder.getContext();
        if(context == null) {
            System.err.println("No event context found!");
            return;
        }

        String sessionId = headerAccessor.getSessionId();
        String eventName = context.getEventName();
        EventConfig config = context.getEventConfig();
        System.out.println("Handling event: " + eventName + " from session: " + sessionId);

        try {
            Object res = config.getHandler().handle(sessionId, payload, headerAccessor);
            if(config.isBroadcast() && res != null) socketMethods.broadcastToDestination(config.getDestination(), res);
        } catch(Exception err) {
            System.err.println("Error handling event " + eventName + ": " + err.getMessage());
            err.printStackTrace();

            Map<String, Object> errRes = new HashMap<>();
            errRes.put("error", eventName);
            errRes.put("message", err.getMessage());
            socketMethods.send(sessionId, "error", errRes);
        } finally {
            EventContextHolder.clearContext();
        }
    }
}
