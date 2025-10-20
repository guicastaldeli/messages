package com.app.main.root.app._data;
import java.util.Collections;

import org.springframework.messaging.Message;
import org.springframework.messaging.simp.SimpMessageHeaderAccessor;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Component;
import com.app.main.root.app.EventTracker;
import com.app.main.root.app.EventLog.EventDirection;

@Component
public class SocketMethods {
    private final SimpMessagingTemplate messagingTemplate;
    private final EventTracker eventTracker;

    public SocketMethods(
        SimpMessagingTemplate messagingTemplate,
        EventTracker eventTracker
    ) {
        this.messagingTemplate = messagingTemplate;
        this.eventTracker = eventTracker;
    }

    /*
    ** Send To User
    */
    public void sendToUser(
        String sessionId,
        String event,
        Object data
    ) {
        try {
            eventTracker.track(
                event,
                data,
                EventDirection.SENT,
                sessionId,
                "system"
            );
            messagingTemplate.convertAndSendToUser(
                sessionId,
                "/queue/" + event,
                data
            );
        } catch(Exception err) {
            System.err.println("Error sending message: " + err.getMessage());
        }
    }

    /*
    ** Send
    */
    public void send(
        String sessionId,
        String destination,
        Object data
    ) {
        try {
            eventTracker.track(
                destination,
                data,
                EventDirection.SENT,
                sessionId,
                "system"
            );
            messagingTemplate.convertAndSend(
                destination,
                data
            );
        } catch(Exception err) {
            System.err.println("Error sending message: " + err.getMessage());
        }
    }

    /*
    ** Broadcast to All 
    */
    public void broadcast(String event, Object data) {
        try {
            eventTracker.track(
                event,
                data,
                EventDirection.SENT,
                "broadcast",
                "system"
            );
            messagingTemplate.convertAndSend(
                "/topic/" + event,
                data
            );
        } catch(Exception err) {
            System.err.println("Error broadcasting message: " + err.getMessage());
        }
    }


    /*
    * Broadcast to Others 
    */
    public void broadcastOthers(
        String destination,
        Object data,
        String sessionId
    ) {
        try {
            eventTracker.track(
                "broadcast" + destination + "-x-" + sessionId,
                data,
                EventDirection.SENT,
                "broadcast",
                "system"
            );

            messagingTemplate.convertAndSend(
                destination,
                data,
                Collections.singletonMap("excludeSessionId", sessionId)
            );
        } catch(Exception err) {
            System.err.println("Error broadcasting to " + destination + " except " + sessionId + ": " + err.getMessage());
        }
    }

    /*
    * Broadcast to Destination 
    */
    public void broadcastToDestination(String destination, Object data) {
        try {
            eventTracker.track(
                "broadcast" + destination,
                data,
                EventDirection.SENT,
                "broadcast",
                "system"
            );
            messagingTemplate.convertAndSend(destination, data);
        } catch(Exception err) {
            System.err.println("Error broadcasting to " + destination + ": " + err.getMessage());
        }
    }

    /*
    ** Session Id 
    */
    public String getSessionId(Object src) {
        if(src instanceof String) {
            return (String) src;
        } else if(src instanceof SimpMessageHeaderAccessor) {
            SimpMessageHeaderAccessor accessor = (SimpMessageHeaderAccessor) src;
            return accessor.getSessionId();
        } else if(src instanceof Message) {
            Message<?> message = (Message<?>) src;
            SimpMessageHeaderAccessor accessor = SimpMessageHeaderAccessor.wrap(message);
            return accessor.getSessionId();
        }
        return "unknown";
    }

    /*
    * Socket Username 
    */
    public String getSocketUsername(String sessionId) {
        return sessionId;
    }
}
