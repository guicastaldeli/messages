package com.app.main.root.app._server;
import org.springframework.web.socket.*;
import org.springframework.web.socket.client.WebSocketClient;
import org.springframework.web.socket.client.standard.StandardWebSocketClient;
import org.springframework.web.socket.handler.AbstractWebSocketHandler;
import java.net.URI;
import java.util.*;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.ExecutionException;
import java.util.function.Consumer;

public class SocketClient {
    private static SocketClient instance;
    private WebSocketSession session;
    private SocketEmitter socketEmitter;
    private final Map<String, List<Consumer<Object>>> eventListeners = new HashMap<>();

    private String url;
    private String sessionId;
    private boolean isConnecting = false;
    private boolean isConnected = false;
    private final WebSocketClient webSocketClient;

    private SocketClient() {
        this.webSocketClient = new StandardWebSocketClient();
    }

    public static SocketClient getInstance() {
        if(instance == null) {
            synchronized(SocketClient.class) {
                if(instance == null) {
                    instance = new SocketClient();
                }
            }
        }
        return instance;
    }

    /* Get Socket Emitter */
    public SocketEmitter getSocketEmitter() {
        return socketEmitter;
    }

    /*
    ** Get Url 
    */
    private String getUrl() {
        try {
            String host = "localhost";
            String protocol = "ws";
            String port = System.getenv("PORT");
            if(port == null || port.isEmpty()) {
                port = "8080";
            }
            if(isBrowserEnvironment()) {
                host = getHostFromBrowser();
                protocol = getProtocolFromBrowser();
            }

            String formUrl = protocol + "://" + host + ":" + port + "/ws";
            this.url = formUrl;
            return this.url;
        } catch(Exception err) {
            System.err.println("Error getting URL: " + err.getMessage());
            return "ws://localhost:8080/ws";
        }
    }

    private boolean isBrowserEnvironment() {
        return false;
    }

    /*
    ** Context 
    */
    private String getHostFromBrowser() {
        return "localhost";
    }

    private String getProtocolFromBrowser() {
        return "ws";
    }

    public CompletableFuture<Void> connect() {
        if(isConnecting || isConnected) return CompletableFuture.completedFuture(null);
        isConnecting = true;

        return CompletableFuture.runAsync(() -> {
            try {
                String connectionUrl = getUrl();
                URI serverUri = URI.create(connectionUrl);
                WebSocketHandler handler = new WebSocketHandler();

                this.session = webSocketClient.doHandshake(handler, null, serverUri).get();
                this.socketEmitter = new SocketEmitter(session);
                this.socketEmitter.registerAllEvents((event, data) -> this.emitEvent(event, data));
                System.out.println("Connected to WebSocket server: " + connectionUrl);
            } catch(InterruptedException | ExecutionException err) {
                System.err.println("Connection error: " + err.getMessage());
                isConnecting = false;
                throw new RuntimeException("Connection Failed", err);
            }
        });
    }

    public void on(String event, Consumer<Object> callback) {
        eventListeners.computeIfAbsent(event, k -> new CopyOnWriteArrayList<>()).add(callback);
    }

    public void off(String event, Consumer<Object> callback) {
        List<Consumer<Object>> listeners = eventListeners.get(event);
        if(listeners != null) listeners.remove(callback);
    }

    public void emitEvent(String event, Object data) {
        List<Consumer<Object>> listeners = eventListeners.get(event);
        if(listeners != null) {
            for(Consumer<Object> callback : listeners) {
                try {
                    callback.accept(data);
                } catch(Exception err) {
                    System.err.println("Error in event listener" + event + ": " + err.getMessage());
                }
            }
        }
    }

    public String getSessionId() {
        return sessionId;
    }

    public boolean isConnected() {
        return isConnected && session != null && session.isOpen();
    }

    public void disconnect() {
        try {
            if(session != null && session.isOpen()) session.close();
            isConnected = false;
            isConnecting = false;
            sessionId = null;
        } catch(Exception err) {
            System.err.println("Error disconnecting: " + err.getMessage());
        }
    }

    /*
    **
    *** WebSocket
    ** 
    */
    private class WebSocketHandler extends AbstractWebSocketHandler {
        @Override
        public void afterConnectionEstablished(WebSocketSession session) {
            sessionId = session.getId();
            isConnected = true;
            isConnecting = false;
            emitEvent("connect", sessionId);
        }

        @Override
        public void handleTextMessage(WebSocketSession session, TextMessage message) {
            try {
                String payload = message.getPayload();
                WebSocketMessage msg = parseMessage(payload);
                emitEvent(msg.getEvent(), msg.getData());
            } catch(Exception err) {
                System.err.println("Error handling message: " + err.getMessage());
            }
        }

        @Override
        public void afterConnectionClosed(WebSocketSession session, CloseStatus status) {
            isConnected = false;
            emitEvent("disconnect", status);
        }

        @Override
        public void handleTransportError(WebSocketSession session, Throwable exception) {
            System.err.println("Transport error: " + exception.getMessage());
            emitEvent("error", exception.getMessage());
        }

        private WebSocketMessage parseMessage(String payload) {
            try {
                String event = extractValue(payload, "event");
                String data = extractValue(payload, "data");
                return new WebSocketMessage(event, data);
            } catch(Exception err) {
                return new WebSocketMessage("message", payload);
            }
        }

        private String extractValue(String json, String key) {
            int start = json.indexOf("\"" + key + "\":") + key.length() + 3;
            int end = json.indexOf(",", start);
            if (end == -1) end = json.indexOf("}", start);
            if (end == -1) end = json.length();
            return json.substring(start, end).replace("\"", "").trim();
        }
    }

    /*
    **
    *** WebSocketMessage
    **
    */
    private static class WebSocketMessage {
        private final String event;
        private final Object data;

        public WebSocketMessage(String event, Object data) {
            this.event = event;
            this.data = data;
        }
        public String getEvent() {
            return event;
        }
        public Object getData() {
            return this.data;
        }
    }
}

