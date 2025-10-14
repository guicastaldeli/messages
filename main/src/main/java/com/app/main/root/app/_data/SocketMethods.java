package com.app.main.root.app._data;
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
    ** Send 
    */
    public void send(
        Object socket,
        String event,
        Object data
    ) {
        try {
            String sessionId = getSessionId(socket);

            eventTracker.track(
                event,
                data,
                EventDirection.SENT,
                sessionId,
                event
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
    ** Session Id 
    */
    public String getSessionId(Object socket) {
        if(socket instanceof String) return (String) socket;
        return "unknown";
    }

    /*
    * Socket Username 
    */
    public String getSocketUsername(String sessionId) {
        return "Anonymous";
    }
}
