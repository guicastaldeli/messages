package com.app.main.root.app.__config;
import java.util.Map;
import org.springframework.context.event.EventListener;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.messaging.SessionConnectEvent;
import org.springframework.web.socket.messaging.SessionDisconnectEvent;
import org.springframework.web.socket.messaging.SessionSubscribeEvent;
import com.app.main.root.app._server.ConnectionTracker;
import com.app.main.root.app.__controllers.ConnectionController;

@Component
public class StompEventListener {
    private final ConnectionTracker connectionTracker;
    private final ConnectionController connectionController;

    public StompEventListener(ConnectionTracker connectionTracker) {
        this.connectionTracker = connectionTracker;
        this.connectionController = new ConnectionController();
    }

    @EventListener
    public void handleWebSocketConnectListener(SessionConnectEvent event) {
        StompHeaderAccessor headers = StompHeaderAccessor.wrap(event.getMessage());
        String sessionId = headers.getSessionId();

        //Client info
        String ipAddress = getClientIp(headers);
        String userAgent = headers.getFirstNativeHeader("User-Agent");
        String agent = userAgent != null ? userAgent : "Unknown";

        connectionTracker.trackConnection(sessionId, ipAddress, agent);
        connectionController.getSocketId(agent);
        connectionController.getConnectionInfo(sessionId);
        connectionController.getActiveSocketIds();
    }

    @EventListener
    public void handleWebSocketDisconnectListener(SessionDisconnectEvent event) {
        StompHeaderAccessor headers = StompHeaderAccessor.wrap(event.getMessage());
        String sessionId = headers.getSessionId();
        connectionTracker.trackDisconnection(sessionId);
    }

    @EventListener
    public void handleSubscription(SessionSubscribeEvent event) {
        StompHeaderAccessor headers = StompHeaderAccessor.wrap(event.getMessage());
        String sessionId = headers.getSessionId();
        String destination = headers.getDestination();

        System.out.println("Client " + sessionId + " subscribed to: " + destination);
    }

    private String getClientIp(StompHeaderAccessor headers) {
        String ip = headers.getFirstNativeHeader("X-Forwarded-For");
        if(ip == null || ip.isEmpty()) ip = headers.getFirstNativeHeader("X-Real-IP");

        if(ip == null || ip.isEmpty()) {
            Map<String, Object> sessionAttr = headers.getSessionAttributes();
            if(sessionAttr != null) ip = (String) sessionAttr.get("remoteAddress");
        }

        String returnIp = ip != null ? ip : "Unknown";
        return returnIp;
    }
}
