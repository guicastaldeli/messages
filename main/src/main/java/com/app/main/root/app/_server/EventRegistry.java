package com.app.main.root.app._server;
import java.util.concurrent.ConcurrentHashMap;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Component;
import java.util.*;

@Component
public class EventRegistry {
    @FunctionalInterface
    public interface SocketEventHandler {
        Object handle(
            String sessionId,
            Object data,
            SimpMessagingTemplate messagingTemplate
        );
    }

    private static final Map<String, EventHandlerConfig> events = new ConcurrentHashMap<>();

    public static class EventHandlerConfig {
        public String eventName;
        public SocketEventHandler handler;
        public boolean broadcast;
        public boolean broadcastSelf;
        public String targetEvent;
        public String destination;

        public EventHandlerConfig(
            String eventName,
            SocketEventHandler handler,
            boolean broadcast,
            boolean broadcastSelf,
            String targetEvent,
            String destination
        ) {
            this.eventName = eventName;
            this.handler = handler;
            this.broadcast = broadcast;
            this.broadcastSelf = broadcastSelf;
            this.targetEvent = targetEvent;
            this.destination = destination;
        }
    }

    public static void registerEvent(EventHandlerConfig handlerConfig) {
        events.put(handlerConfig.eventName, handlerConfig);
    }

    public static void registerAllEvents(List<EventHandlerConfig> eventsList) {
        for(EventHandlerConfig event : eventsList) {
            registerEvent(event);
        }
    }

    public static EventHandlerConfig getEvent(String eventName) {
        return events.get(eventName);
    }

    public static List<EventHandlerConfig> getAllEvents() {
        return new ArrayList<>(events.values());
    }

    public static EventHandlerConfig createBroadcastEvent(
        String eventName,
        SocketEventHandler handler,
        String destination,
        boolean broadcast
    ) {
        return new EventHandlerConfig(
            eventName,
            handler,
            broadcast,
            false,
            eventName,
            destination
        );
    }

    private static void broadcastMessage(
        String sessionId,
        SimpMessagingTemplate messagingTemplate,
        String eventName,
        Object data,
        boolean broadcastSelf
    ) {
        String dest = "/topic" + eventName;
        messagingTemplate.convertAndSend(dest, data);
    }

    private static void broadcastToOthers(
        WebSocketSession curSession,
        SimpMessagingTemplate messagingTemplate,
        String dest,
        Object data
    ) {
        messagingTemplate.convertAndSend(dest, data);
    }

    public static void handleEvent(
        String eventName,
        String sessionId,
        Object data,
        SimpMessagingTemplate messagingTemplate
    ) {
        EventHandlerConfig eventConfig = events.get(eventName);
        if(eventConfig != null && eventConfig.destination != null) {
            try {
                Object result = eventConfig.handler.handle(sessionId, data, messagingTemplate);
    
                if(eventConfig.destination != null) {
                    if(eventConfig.broadcast) {
                        messagingTemplate.convertAndSend(eventConfig.destination, result);
                    } else {
                        messagingTemplate.convertAndSendToUser(sessionId, eventConfig.destination, result);
                    }
                }
            } catch(Exception err) {
                System.err.println("Error handling event " + eventName + ": " + err.getMessage());
                messagingTemplate.convertAndSendToUser(
                    sessionId,
                    "/queue/errors",
                    Map.of(
                        "error",
                        "Failed to process" + eventName,
                        "details",
                        err.getMessage()
                    )
                );
            }
        } else {
            System.err.println("No handler found for event: " + eventName);
        }
    }
}