package com.app.main.root.app._server;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketHandler;
import org.springframework.web.socket.WebSocketMessage;
import org.springframework.web.socket.WebSocketSession;
import com.app.main.root.app.__config.BufferConfig;
import com.fasterxml.jackson.databind.ObjectMapper;

public class SocketHandler implements WebSocketHandler {
    private final SimpMessagingTemplate messagingTemplate;
    private final ConnectionTracker connectionTracker;
    private final BufferConfig bufferConfig;
    private final ObjectMapper objectMapper;
    private WebSocketSession webSocketSession;

    public SocketHandler(
        SimpMessagingTemplate messagingTemplate,
        ConnectionTracker connectionTracker,
        WebSocketSession webSocketSession
    ) {
        this.messagingTemplate = messagingTemplate;
        this.connectionTracker = connectionTracker;
        this.webSocketSession = webSocketSession;
        this.bufferConfig = new BufferConfig();
        this.objectMapper = new ObjectMapper();
    }

    @Override
    public void afterConnectionEstablished(WebSocketSession session) throws Exception {
        String ipAddress = getClientIp(session);
        String userAgent = session.getHandshakeHeaders().getFirst("User-Agent");
        connectionTracker.trackConnection(session.getId(), ipAddress, userAgent);
        connectionTracker.getAllConnections();
        
        session.getAttributes().put("username", "Anonymous");
        session.getAttributes().put("remoteAddress", ipAddress);
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
        bufferConfig.clearBuffer(session.getId());
        connectionTracker.trackDisconnection(session.getId());
    }

    private void handleWebSocketMessage(WebSocketSession session, String payload) {
        try {
            String sessionId = session.getId();
            String completeMessage = bufferConfig.handleMessage(sessionId, payload);

            if(completeMessage != null) {
                WebSocketMessageData messageData = parseWebSocketMessageJson(completeMessage);
                String eventName = messageData.getEvent();
                Object data = messageData.getData();
                EventRegistry.EventHandlerConfig eventConfig = EventRegistry.getEvent(eventName);

                if(eventConfig != null) {
                    eventConfig.handler.handle(sessionId, data, messagingTemplate);
                } else {
                    System.out.println("No handler found for event: " + eventName);
                }
            }
        } catch(Exception err) {
            System.err.println("Error handling WebSocket message: " + err.getMessage());
            err.printStackTrace();
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
    private WebSocketMessageData parseWebSocketMessageJson(String payload) {
        try {
            SocketMessage parsedMessage = objectMapper.readValue(payload, SocketMessage.class);
            return new WebSocketMessageData(parsedMessage.getEvent(), parsedMessage.getData());
        } catch(Exception err) {
            new WebSocketMessageData("message", payload);
            return parseWebSocketMessage(payload);
        }
    }

    private WebSocketMessageData parseWebSocketMessage(String payload) {
        try {
            String event = extractValue(payload, "event");
            Object data = extractValue(payload, "data");
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

    private static class SocketMessage {
        private String event;
        private Object data;

        public void setEvent(String event) {
            this.event = event;
        }
        public String getEvent() {
            return event;
        }
        public void setData(Object data) {
            this.data = data;
        }
        public Object getData() {
            return data;
        }
    }
}
