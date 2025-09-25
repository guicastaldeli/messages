//package com.app.app._root;
import java.net.Socket;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.function.BiFunction;
//import org.springframework.boot.SpringApplication;
//import org.springframework.boot.autoconfigure.SpringBootApplication;

@FunctionalInterface
public interface SocketEventHandler {
    void handle(
        Object socket,
        Object data,
        Object io
    );
}

public class EventRegistry {
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
            (socket, data, io) -> {
                handler.handle(socket, data, io);
                if(io != null) {
                    String emitEventName = targetEvent != null ? targetEvent : eventName;

                    //FIX LATER 
                    // This part depends on your WebSocket library implementation
                    // You'll need to adapt this to your specific WebSocket framework
                }
            },
            true,
            broadcastSelf != null ? broadcastSelf : false,
            targetEvent
        );
    }
}