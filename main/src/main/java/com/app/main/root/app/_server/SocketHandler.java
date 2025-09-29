package com.app.main.root.app._server;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketHandler;
import org.springframework.web.socket.WebSocketMessage;
import org.springframework.web.socket.WebSocketSession;

public class SocketHandler implements WebSocketHandler {
    private final SimpMessagingTemplate messagingTemplate;
    private final ConnectionTracker connectionTracker;
    private WebSocketSession webSocketSession;

    public SocketHandler(
        SimpMessagingTemplate messagingTemplate,
        ConnectionTracker connectionTracker,
        WebSocketSession webSocketSession
    ) {
        System.out.println("test socket");
        this.messagingTemplate = messagingTemplate;
        this.connectionTracker = connectionTracker;
        this.webSocketSession = webSocketSession;
    }

    @Override
    public void afterConnectionEstablished(WebSocketSession session) throws Exception {
        String ipAddress = getClientIp(session);
        String userAgent = session.getHandshakeHeaders().getFirst("User-Agent");
        connectionTracker.trackConnection(session.getId(), ipAddress, userAgent);
        webSocketSession.getAttributes().put("username", "Anonymous");
    }

    @Override
    public void handleMessage(WebSocketSession session, WebSocketMessage<?> message) throws Exception {
        if(message instanceof TextMessage textMessage) {
            String payload = textMessage.getPayload();
            handleWebSocketMessage(session, payload);
        }
    }

    @Override
    public void handleTransportError(WebSocketSession session, Throwable exception) throws Exception {
        System.err.println("Transport error for session " + session.getId() + exception.getMessage());
    }

    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus closeStatus) {
        connectionTracker.trackDisconnection(session.getId());
    }

    private void handleWebSocketMessage(WebSocketSession session, String payload) {
        try {
            WebSocketMessageData message = parseWebSocketMessage(payload);
            String eventName = message.getEvent();
            Object data = message.getData();
            EventRegistry.EventHandlerConfig eventConfig = EventRegistry.getEvent(eventName);

            if(eventConfig != null) {
                eventConfig.handler.handle(session, data, messagingTemplate);
            } else {
                System.out.println("No handler found for event: " + eventName);
            }
        } catch(Exception err) {
            System.err.println("Error handling WebSocket message: " + err.getMessage());
        }
    }

    private String getClientIp(WebSocketSession session) {
        return session.getRemoteAddress().getAddress().getHostAddress();
    }

    @Override
    public boolean supportsPartialMessages() {
        return false;
    }

    /*
    **
    *** Parsers
    ** 
    */
    private WebSocketMessageData parseWebSocketMessage(String payload) {
        try {
            String event = extractValue(payload, "event");
            String data = extractValue(payload, "data");
            return new WebSocketMessageData(event, data);
        } catch(Exception err) {
            return new WebSocketMessageData("message", payload);
        }
    }

    private String extractValue(String json, String key) {
        int keyIndex = json.indexOf("\"" + key + "\":");
        if (keyIndex == -1) return "";
            
        int valueStart = json.indexOf(":", keyIndex) + 1;
        int valueEnd = json.indexOf(",", valueStart);
        if (valueEnd == -1) valueEnd = json.indexOf("}", valueStart);
        if (valueEnd == -1) valueEnd = json.length();
            
        String value = json.substring(valueStart, valueEnd).trim();
        if (value.startsWith("\"") && value.endsWith("\"")) {
            value = value.substring(1, value.length() - 1);
        }
        return value;
    }
}
