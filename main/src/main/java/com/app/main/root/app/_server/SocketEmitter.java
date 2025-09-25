package com.app.main.root.app._server;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import java.io.IOException;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.function.Consumer;
import com.fasterxml.jackson.databind.ObjectMapper;

public class SocketEmitter {
    private static SocketEmitter instance;
    private WebSocketSession session;
    private final Map<String, EventHandler> eventHandlers = new ConcurrentHashMap<>();
    private final Map<String, EmitHandler> emitHandlers = new ConcurrentHashMap<>();
    private final ObjectMapper mapper = new ObjectMapper();

    //
    // *** Interface Types
    //
        interface EventTypes {
            String getEventName();
            void handle(Object data);
            boolean isAutoRegister();
        }

        interface EmitTypes {
            String getEventName();
            void emit(Object data);
        }
    //

    public SocketEmitter(WebSocketSession session) {
        this.session = session;
    }

    public static SocketEmitter getInstance(WebSocketSession session) {
        if(instance == null) {
            synchronized(SocketEmitter.class) {
                if(instance == null) {
                    instance = new SocketEmitter(session);
                }
            }
        }
        return instance;
    }

    /*
    **
    *** Handlers
    ** 
    */
    public static class EventHandler implements EventTypes {
        private final String eventName;
        private final Consumer<Object> handler;
        private final boolean autoRegister;

        public EventHandler(
            String eventName,
            Consumer<Object> handler,
            boolean autoRegister
        ) {
            this.eventName = eventName;
            this.handler = handler;
            this.autoRegister = autoRegister;
        }
        @Override 
        public String getEventName() {
            return eventName;
        }
        @Override
        public void handle(Object data) {
            handler.accept(data);
        }
        @Override
        public boolean isAutoRegister() {
            return this.autoRegister;
        }
    }

    public static class EmitHandler implements EmitTypes {
        private final String eventName;
        private final Consumer<Object> emitter;

        public EmitHandler(String eventName, Consumer<Object> emitter) {
            this.eventName = eventName;
            this.emitter = emitter;
        }
        @Override
        public String getEventName() {
            return eventName;
        }
        @Override
        public void emit(Object data) {
            emitter.accept(data);
        }
    }

    /*
    **
    *** Registers
    ** 
    */
    public void registerEventHandler(EventHandler handler) {
        eventHandlers.put(handler.getEventName(), handler);
    }

    public void registerAllEventsHandlers(List<EventHandler> handlers) {
        for(EventHandler handler : handlers) {
            registerEventHandler(handler);
        }
    }

    public void registerEmitHandler(EmitHandler handler) {
        emitHandlers.put(handler.getEventName(), handler);
    }

    public void registerAllEmitHandlers(List<EmitHandler> handlers) {
        for(EmitHandler handler : handlers) {
            registerEmitHandler(handler);
        }
    }

    public void registerAllEvents(Consumer<String> emitEvent) {
        for(EventHandler handler : eventHandlers.values()) {
            if(handler.isAutoRegister()) {
                System.out.println("Registered event: " + handler.getEventName());
            }
        }
    }

    public void handleIncomingEvent(String eventName, Object data) {
        EventHandler handler = eventHandlers.get(eventName);
        if(handler != null) handler.handle(data);
    }

    public void emit(String eventName, Object data) {
        EmitHandler emitHandler = emitHandlers.get(eventName);
        if(emitHandler != null) {
            emitHandler.emit(data);
        } else if(session != null && session.isOpen()) {
            try {
                String message = createMessage(eventName, data);
                session.sendMessage(new TextMessage(message));
            } catch(IOException err) {
                System.err.println("Error sending message: " + err.getMessage());
            }
        }
    }

    private String createMessage(String eventName, Object data) {
        try {
            Map<String, Object> message = new HashMap<>();
            message.put("event", eventName);
            message.put("data", data);
            message.put("timestamp", System.currentTimeMillis());
            return mapper.writeValueAsString(message);
        } catch(Exception err) {
            String format = "{\"event\":\"%s\",\"data\":\"%s\"}";
            return String.format(format, eventName, data.toString());
        }
    }

    public void setSession(WebSocketSession session) {
        this.session = session;
    }

    public boolean isConnected() {
        return session != null && session.isOpen();
    }
}