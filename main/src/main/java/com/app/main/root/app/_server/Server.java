package com.app.main.root.app._server;
import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.web.socket.config.annotation.EnableWebSocket;
import org.springframework.web.socket.config.annotation.WebSocketConfigurer;
import org.springframework.web.socket.config.annotation.WebSocketHandlerRegistry;
import org.springframework.web.socket.WebSocketHandler;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.CloseStatus;
import com.app.main.root.app._data.ConfigSocketEvents;
import org.springframework.web.socket.WebSocketMessage;

@Component
@EnableWebSocket
public class Server implements WebSocketConfigurer, CommandLineRunner {
    private static Server instance;
    private final SimpMessagingTemplate messagingTemplate;
    private final ConnectionTracker connectionTracker;
    private final ConfigSocketEvents configSocketEvents;
    private WebSocketSession webSocketSession;

    private String url;
    private String port;

    public Server(SimpMessagingTemplate messagingTemplate, ConfigSocketEvents configSocketEvents) {
        this.messagingTemplate = messagingTemplate;
        this.connectionTracker = new ConnectionTracker();
        this.configSocketEvents = new ConfigSocketEvents(null, connectionTracker, null, null);
        instance = this;
    }

    public static Server getInstance(String url, Object timeStream) {
        return instance;
    }

    public void init(String port) {
        this.port = port;
        this.url = "http://localhost:" + port;
        System.out.println("Server initialized on port: " + port);
        System.out.println("endpoint avaliable at: " + this.url + "/ws");
        initComponents();
    }

    @Override
    public void run(String... args) throws Exception {
        configSockets();

        if(this.port == null) {
            String envPort = System.getenv("PORT");
            if(envPort != null && !envPort.trim().isEmpty()) {
                init(envPort);
            } else {
                init("8080");
            }
        }
    }

    private void initComponents() {
        System.out.println("Server components initialized!");
        System.out.println("Connection tracker ready: " + (connectionTracker != null));
        System.out.println("Message template ready: " + (messagingTemplate != null));
    }

    @Override
    public void registerWebSocketHandlers(WebSocketHandlerRegistry registry) {
        registry.addHandler(new SocketHandler(), "/ws").setAllowedOrigins("*");
    }

    private void configSockets() {
        configSocketEvents.configSocketEvents();
    }

    /* 
    **
    *** Socket Handler
    ** 
    */
    private class SocketHandler implements WebSocketHandler {
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

        private String getClientIp(WebSocketSession session) {
            return session.getRemoteAddress().getAddress().getHostAddress();
        }
    }

    public ConnectionTracker getConnectionTracker() {
        return connectionTracker;
    }
}