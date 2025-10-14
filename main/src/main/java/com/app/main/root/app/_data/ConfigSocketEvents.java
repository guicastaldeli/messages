package com.app.main.root.app._data;
import com.app.main.root.app.EventTracker;
import com.app.main.root.app._db.DbService;
import com.app.main.root.app.main._messages_config.MessageTracker;
import com.app.main.root.app._server.EventRegistry;
import com.app.main.root.app._server.ConnectionTracker;
import org.springframework.context.ApplicationListener;
import org.springframework.messaging.handler.annotation.DestinationVariable;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.messaging.simp.SimpMessageHeaderAccessor;
import org.springframework.messaging.simp.broker.BrokerAvailabilityEvent;
import org.springframework.messaging.simp.annotation.support.SimpAnnotationMethodMessageHandler;
import org.springframework.messaging.handler.invocation.InvocableHandlerMethod;
import org.springframework.stereotype.Component;
import java.util.concurrent.ConcurrentHashMap;
import java.util.*;

@Component
public class ConfigSocketEvents implements ApplicationListener<BrokerAvailabilityEvent> {
    public interface EventHandler {
        Object handle(
            String sessionId,
            Object payload,
            SimpMessageHeaderAccessor headerAccessor
        );
    }

    private final EventList eventList;
    private final SimpAnnotationMethodMessageHandler messageHandler;
    private final EventRegistry eventRegistry;
    private final EventTracker eventTracker;
    private final MessageTracker messageTracker;
    private final ConnectionTracker connectionTracker;
    private final DbService dbService;
    private final SocketMethods socketMethods;
    private final Map<String, InvocableHandlerMethod> handlerMethods = new ConcurrentHashMap<>();
    private final Map<String, EventConfig> eventConfigs = new ConcurrentHashMap<>();

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
        this.eventList = new EventList(
            dbService, 
            eventTracker, 
            connectionTracker, 
            socketMethods, 
            messageTracker
        );
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
        Map<String, EventConfig> configs = eventList.list();

        for(Map.Entry<String, EventConfig> entry : configs.entrySet()) {
            String eventName = entry.getKey();
            EventConfig config = entry.getValue();
            registerEventHandler(eventName, config);
            useEventRegistry(eventName, config);
            System.out.println("Dynamically Registered handler for: /app/" + eventName);
        }
        System.out.println("Total handlers registered: " + eventConfigs.size());
    }

    private void registerEventHandler(String eventName, EventConfig config) {
        eventConfigs.put(eventName, config);
    }

    private void useEventRegistry(String eventName, EventConfig config) {
        EventRegistry.EventHandlerConfig registryConfig =
        new EventRegistry.EventHandlerConfig(
            eventName,
            (sessionId, data, messagingTemplate) -> {
                return config.getHandler().handle(sessionId, data, null);
            },
            config.isBroadcast(),
            false,
            eventName,
            config.getDestination()
        );
        EventRegistry.registerEvent(registryConfig);
    }

    @MessageMapping("{eventName}")
    public void handleEvent(
        @DestinationVariable String eventName,
        @Payload Map<String, Object> payload,
        SimpMessageHeaderAccessor headerAccessor
    ) {
        EventConfig config = eventConfigs.get(eventName);
        if(config == null) {
            System.err.println("No handler found for event: " + eventName);
            return;
        }

        String sessionId = headerAccessor.getSessionId();
        System.out.println("Handling event: " + eventName + " from session: " + sessionId);

        try {
            Object res = config.getHandler().handle(sessionId, payload, headerAccessor);
            if(config.isBroadcast() && res != null) socketMethods.broadcastToDestination(config.getDestination(), res);
            socketMethods.send(sessionId, eventName, res);
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
