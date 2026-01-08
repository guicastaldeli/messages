package com.app.main.root.app.__controllers;
import com.app.main.root.app.EventTracker;
import com.app.main.root.app._data.EventList;
import com.app.main.root.app._data.EventConfig;
import com.app.main.root.app._data.SocketMethods;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.messaging.simp.SimpMessageHeaderAccessor;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Controller;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.Map;

@Controller
public class DynamicEventController {
    private final EventTracker eventTracker;
    private final Map<String, EventConfig> eventConfigs;
    private EventList eventList;
    private SocketMethods socketMethods;
    private final SimpMessagingTemplate messagingTemplate;

    public DynamicEventController(
        EventTracker eventTracker, 
        EventList eventList,
        SocketMethods socketMethods,
        SimpMessagingTemplate messagingTemplate
    ) {
        this.eventTracker = eventTracker;
        this.eventConfigs = eventList.list();
        this.socketMethods = socketMethods;
        this.messagingTemplate = messagingTemplate;
    } 

    @MessageMapping("**")
    public void handleEvents(
        SimpMessageHeaderAccessor headerAccessor,
        @Payload Map<String, Object> payload
    ) {
        String destination = headerAccessor.getDestination();

        if(destination != null && destination.startsWith("/app/")) {
            String eventName = destination.substring(5);
            EventConfig config = eventConfigs.get(eventName);

            if(config != null) {
                String sessionId = headerAccessor.getSessionId();

                try {
                    Object res = config.getHandler().handle(sessionId, payload, headerAccessor);
                    socketMethods.send(sessionId, config.getDestination(), res);
                    if(config.isBroadcast() && res != null) socketMethods.broadcastToDestination(destination, res);
                } catch(Exception err) {
                    String errorMessage = err.getMessage();
                    if(errorMessage == null) {
                        errorMessage = "Unknown error (null message)";
                    }
                    System.err.println("Error handling event " + eventName + ": " + errorMessage);
                    err.printStackTrace();
                }
            } else {
                System.err.println("Event handler not found for: " + eventName);
                System.err.println("Available events: " + eventConfigs.keySet());
                
                Map<String, Object> errorResponse = new HashMap<>();
                errorResponse.put("error", "EVENT_HANDLER_NOT_FOUND");
                errorResponse.put("event", eventName);
                errorResponse.put("availableEvents", new ArrayList<>(eventConfigs.keySet()));
                
                String sessionId = headerAccessor.getSessionId();
                if(sessionId != null) {
                    socketMethods.send(sessionId, "/queue/errors", errorResponse);
                }
            }
        }
    }
}
