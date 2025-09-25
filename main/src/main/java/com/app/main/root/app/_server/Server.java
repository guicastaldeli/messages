package com.app.main.root.app._server;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.web.socket.config.annotation.EnableWebSocket;
import org.springframework.web.socket.config.annotation.WebSocketConfigurer;
import org.springframework.web.socket.config.annotation.WebSocketHandlerRegistry;
import org.springframework.web.socket.WebSocketHandler;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketMessage;
import org.springframework.web.socket.CloseStatus;
import com.app.main.root.app._utils.ColorConverter;
import java.util.Map;

@Component
@EnableWebSocket
public class Server implements WebSocketConfigurer, CommandLineRunner {
    private static Server instance;
    private final SimpMessagingTemplate messagingTemplate;
    private final ConnectionTracker connectionTracker;
    private final Interface interface;
    private final ColorConverter colorConverter;
    private final EventRegistry eventRegistry;
    private final WebSocketSession webSocketSession;
    private final TextMessage textMessage;
    private final WebSocketMessage webSocketMessage;
    
    private String url;
    private String port;

    @Autowired
    public Server(
        SimpMessagingTemplate messagingTemplate,
        ConnectionTracker connectionTracker,
        Interface interface,
        ColorConverter colorConverter,
        EventRegistry eventRegistry
    ) {
        this.messagingTemplate = messagingTemplate;
        this.connectionTracker = connectionTracker;
        this.interface = interface;
        this.eventRegistry = eventRegistry;
        this.url = "http://localhost:8080";
        this.port = "8080";
        instance = this;
    }

    public static Server getInstance(String url, Object timeStream) {
        return instance;
    }

    @Override
    public void registerWebSocketHandlers(WebSocketHandlerRegistry registry) {
        registry.addHandler(new SocketHandler(), "/ws").setAllowedOrigins("*");
    }

    private void configSockets() {
        configSocketEvents();
    }

    /* 
    **
    *** Socket Handler
    ** 
    */
    private class SocketHandler implements WebSocketHandler {
        @Override
        public void afterConnectionEstablished(WebSocketSession session) throws Exception {
            String ipAddress = getClientIp();
            String userAgent = session.getHandshakeHeaders().getFirst("User-Agent");
            connectionTracker.trackConnection(session.getId(), ipAddress, userAgent);
            webSocketSession.getAttributes().put("username", "Anonymous");
        }

        @Override
        public void handleMessage(WebSocketSession session, WebSocketMessage<?> message) throws Exception {
            if(message instanceof TextMessage) {
                String payload = message.getPayload();
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
                WebSocketMessage message = parseWebSocketMessage(payload);
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

        /*
        **
        *** Parsers
        ** 
        */
        private WebSocketMessage parseWebSocketMessage(String payload) {
            try {
                String event = extractValue(payload, "event");
                String data = extractValue(payload, "data");
                return new WebSocketMessage(event, data);
            } catch(Exception err) {
                return new WebSocketMessage("message", payload);
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

        private String getClientIp(WebSocketSession session) {
            return session.getRemoteAddress().getAddress().getHostAddress();
        }
    }

    private static class WebSocketMessage {
        private final String event;
        private final String data;

        public WebSocketMessage(String event, String data) {
            this.event = event;
            this.data = data;
        }
        public String getEvent() {
            return event;
        }
        public Object getData() {
            return data;
        }
    }

    public ConnectionTracker getConnectionTracker() {
        return connectionTracker;
    }
}