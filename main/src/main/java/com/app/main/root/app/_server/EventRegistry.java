package com.app.main.root.app._server;
import java.util.concurrent.ConcurrentHashMap;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import java.util.*;

public class EventRegistry {
    @FunctionalInterface
    public interface SocketEventHandler {
        Object handle(
            Object socket,
            Object data,
            Object io
        );
    }

    private static final Map<String, EventHandlerConfig> events = new ConcurrentHashMap<>();

    public static class EventHandlerConfig {
        public String eventName;
        public SocketEventHandler handler;
        public boolean broadcast;
        public boolean broadcastSelf;
        public String targetEvent;

        public EventHandlerConfig(
            String eventName,
            SocketEventHandler handler,
            boolean broadcast,
            boolean broadcastSelf,
            String targetEvent
        ) {
            this.eventName = eventName;
            this.handler = handler;
            this.broadcast = broadcast;
            this.broadcastSelf = broadcastSelf;
            this.targetEvent = targetEvent;
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
        Boolean broadcastSelf,
        String targetEvent
    ) {
        return new EventHandlerConfig(
            eventName,
            (SocketEventHandler) (socket, data, io) -> {
                Object result = handler.handle(socket, data, io);
                if(io != null && events.get(eventName).broadcast) {
                    String emitEventName = targetEvent != null ? targetEvent : eventName;
                    broadcastMessage(
                        socket, 
                        io, 
                        emitEventName, 
                        result, 
                        broadcastSelf != null ? broadcastSelf : false
                    );
                }
                return result;
            },
            true,
            broadcastSelf != null ? broadcastSelf : false,
            targetEvent
        );
    }

    private static void broadcastMessage(
        Object socket,
        Object io,
        String eventName,
        Object data,
        boolean broadcastSelf
    ) {
        if(io instanceof SimpMessagingTemplate) {
            SimpMessagingTemplate messagingTemplate = (SimpMessagingTemplate) io;
            String dest = "/topic/" + eventName;

            if(broadcastSelf) {
                messagingTemplate.convertAndSend(dest, data);
            } else {
                if(socket instanceof WebSocketSession) {
                    WebSocketSession currentSession = (WebSocketSession) socket;
                    broadcastToOthers(currentSession, messagingTemplate, dest, data);
                } else {
                    messagingTemplate.convertAndSend(dest, data);
                }
            }
        }
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
        Object socket,
        Object data,
        Object io
    ) {
        EventHandlerConfig eventConfig = events.get(eventName);
        if(eventConfig != null) eventConfig.handler.handle(socket, data, io);
    }

    /*
    * Remove Event 
    */
    public static boolean removeEvent(String name) {
        return events.remove(name) != null;
    }

    public static void removeEvents(List<String> names) {
        for(String name : names) {
            events.remove(name);
        }
    }
}