package com.app.main.root.app._data;
import java.util.HashMap;
import java.util.Map;

import org.springframework.stereotype.Component;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.app.main.root.app._server.EventRegistry;
import com.app.main.root.app.EventTracker;
import com.app.main.root.app.EventLog.EventDirection;

@Component
public class SocketMethods {
    private final ObjectMapper objectMapper = new ObjectMapper();
    private final EventTracker eventTracker;

    public SocketMethods(EventTracker eventTracker) {
        this.eventTracker = eventTracker;
    }

    /*
    **
    *** Send Events
    ** 
    */
    public void send(
        Object socket, 
        String event, 
        Object data
    ) {
        try {
            if(socket instanceof WebSocketSession) {
                WebSocketSession session = (WebSocketSession) socket;
                long timestamp = System.currentTimeMillis();

                Map<String, Object> message = new HashMap<>();
                message.put("event", event);
                message.put("data", data);
                message.put("timestamp", timestamp);
                String payload = objectMapper.writeValueAsString(message);

                if(!isEventRegistered(event)) {
                    eventTracker.track(
                        event, 
                        data, 
                        EventDirection.SENT, 
                        payload, 
                        event
                    );
                    EventRegistry.EventHandlerConfig eventHandlerConfig =
                        EventRegistry.createBroadcastEvent(
                            event,
                            (socketEvent, dataEvent, io) -> {
                                return dataEvent;
                            },
                            true,
                            event
                        );
                    EventRegistry.registerEvent(eventHandlerConfig);
                }
                session.sendMessage(new TextMessage(payload));
            }
        } catch(Exception err) {
            System.out.println(err.getMessage());
        }
    }

    private boolean isEventRegistered(String name) {
        return false;
    }
    
    /*
    **
    *** Session Id
    ** 
    */
    public String getSessionId(Object socket) {
        if(socket instanceof WebSocketSession) {
            return ((WebSocketSession) socket).getId();
        }
        return "unknown";
    }

    /*
    **
    *** Set Socket Username
    ** 
    */
    public void setSocketUsername(Object socket, String username) {
        if(socket instanceof WebSocketSession) {
            WebSocketSession session = (WebSocketSession) socket;
            session.getAttributes().put("username", username);
        }
    }

    /*
    **
    *** Get Socket Username
    ** 
    */
    public String getSocketUsername(Object socket) {
        if(socket instanceof WebSocketSession) {
            WebSocketSession session = (WebSocketSession) socket;
            return (String) session.getAttributes().getOrDefault("username", "Anonymous");
        }
        return "Anonymous";
    }
}
