package com.app.main.root.app._server;
import com.app.main.root.app._utils.ColorConverter;
import java.time.Duration;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArraySet;
import java.util.function.Consumer;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;
import java.util.*;

@Component
public class ConnectionTracker {
    private static ConnectionTracker instance;
    private final Map<String, ConnectionInfo> connections = new ConcurrentHashMap<>();
    private final Set<Consumer<ConnectionInfo>> connectionCallbacks = new CopyOnWriteArraySet<>();
    private final Set<Consumer<ConnectionInfo>> disconnectionCallbacks = new CopyOnWriteArraySet<>();

    @Autowired
    private ColorConverter colorConverter;
    
    public static ConnectionTracker getInstance() {
        return instance;
    }

    public static class ConnectionInfo {
        public String socketId;
        public String sessionId;
        public String username;
        public String account;
        public String ipAddress;
        public String userAgent;
        public String device;
        public String browser;
        public LocalDateTime connectedAt;
        public LocalDateTime disconnectedAt;
        public boolean isConnected;
        public String room;
        public List<String> groups;

        public ConnectionInfo(
            String socketId,
            String ipAddress,
            String userAgent
        ) {
            this.socketId = socketId;
            this.sessionId = socketId;
            this.username = "Anonymous";
            this.account = "Unknown";
            this.ipAddress = ipAddress;
            this.userAgent = userAgent;
            this.device = extractDevice(userAgent);
            this.browser = extractBrowser(userAgent);
            this.connectedAt = LocalDateTime.now();
            this.isConnected = true;
            this.groups = new ArrayList<>();
        }

        public long getConnectionDurationSeconds() {
            if(disconnectedAt != null) return Duration.between(connectedAt, disconnectedAt).getSeconds();
            return Duration.between(connectedAt, LocalDateTime.now()).getSeconds();
        }

        public String getFormattedDuration() {
            long seconds = getConnectionDurationSeconds();
            if(seconds < 60) {
                return seconds + "s";
            } else if(seconds < 3600) {
                return (seconds / 60) + "m " + (seconds % 60) + "s";
            } else {
                long hours = seconds / 3600;
                long minutes = (seconds % 3600) / 60;
                return hours + "h " + minutes + "m";
            }
        }

        /*
        * Device 
        */
        private String extractDevice(String userAgent) {
            if(userAgent == null || userAgent.isEmpty()) return "Unknown";

            userAgent = userAgent.toLowerCase();
            if(
                userAgent.contains("mobile") ||
                userAgent.contains("android") ||
                userAgent.contains("iphone")
            ) {
                return "Mobile";
            } else if(
                userAgent.contains("tablet") || 
                userAgent.contains("ipad")
            ) {
                return "Tablet";
            } else {
                return "Desktop";
            }
        } 

        /*
        * Browser 
        */
        private String extractBrowser(String userAgent) {
            if(userAgent == null || userAgent.isEmpty()) return "Unknown";

            userAgent = userAgent.toLowerCase();
            if (userAgent.contains("chrome") && !userAgent.contains("edg")) {
                return "Chrome";
            } else if (userAgent.contains("firefox")) {
                return "Firefox";
            } else if (userAgent.contains("safari") && !userAgent.contains("chrome")) {
                return "Safari";
            } else if (userAgent.contains("edg")) {
                return "Edge";
            } else if (userAgent.contains("opera")) {
                return "Opera";
            } else {
                return "Other";
            }
        }

        /*
        * ***Log
        */
        @Override
        public String toString() {
            return String.format(
                """
                    ConnectionInfo{
                        socketId='%s',
                        sessionId='%s',
                        username='%s',
                        account='%s',
                        ipAddress='%s',
                        userAgent='%s',
                        device='%s',
                        browser='%s',
                        connectedAt='%s',
                        isConnected='%s',
                        duration=%s
                    }
                """,
                socketId,
                sessionId,
                username,
                account,
                ipAddress,
                userAgent,
                device,
                browser,
                connectedAt,
                isConnected,
                getFormattedDuration()
            );
        }
    }

    public void trackConnection(
        String socketId,
        String ipAddress,
        String userAgent
    ) {
        ConnectionInfo connectionInfo = new ConnectionInfo(socketId, ipAddress, userAgent);
        connectionInfo.isConnected = true;
        connections.put(socketId, connectionInfo);
        logConnection(connectionInfo);
        notifyConnectionCallbacks(connectionInfo);
        System.out.println(connectionInfo.toString());
    }

    public void trackDisconnection(String socketId) {
        ConnectionInfo connectionInfo = connections.get(socketId);
        if(connectionInfo != null) {
            connectionInfo.disconnectedAt = LocalDateTime.now();
            connectionInfo.isConnected = false;
            logDisconnection(connectionInfo);
            notifyDisconnectionCallbacks(connectionInfo);
        }
    }

    public void updateUsername(String socketId, String username) {
        ConnectionInfo connectionInfo = connections.get(socketId);
        if(connectionInfo != null) {
            connectionInfo.username = username;
            connections.put(socketId, connectionInfo);
        }
    }

    public ConnectionInfo getConnection(String socketId) {
        return connections.get(socketId);
    }

    public Map<String, ConnectionInfo> getAllConnections() {
        return new ConcurrentHashMap<>(connections);
    }

    public List<ConnectionInfo> getActiveConnections() {
        List<ConnectionInfo> activeConnections = new ArrayList<>();
        for(ConnectionInfo conn : connections.values()) {
            if(conn.isConnected) {
                activeConnections.add(conn);
            }
        }
        return activeConnections;
    }

    public int getConnectionsCount() {
        return connections.size();
    }

    public int getActiveConnectionsCount() {
        return getActiveConnections().size();
    }

    public void onConnection(Consumer<ConnectionInfo> callback) {
        connectionCallbacks.add(callback);
    }

    public void onDisconnection(Consumer<ConnectionInfo> callback) {
        disconnectionCallbacks.add(callback);
    }

    public void removeConnectionCallback(Consumer<ConnectionInfo> callback) {
        connectionCallbacks.remove(callback);
    }

    public void removeDisconnectionCallback(Consumer<ConnectionInfo> callback) {
        disconnectionCallbacks.remove(callback);
    }

    /* 
    ***
    **** LOGS
    *** 
    */
    private void logConnection(ConnectionInfo info) {
        String timestamp = LocalDateTime.now().format(DateTimeFormatter.ofPattern("HH:mm:ss"));
        String socket = colorConverter.style(info.socketId, "white", "bold");
        String ip = colorConverter.style(info.ipAddress, "white", "bold");
        String prefix = colorConverter.style(timestamp + " - CONNECTED: ", "brightGreen", "italic");
        String suffix = colorConverter.style(" from IP: ", "brightGreen", "italic");
        System.out.println(prefix + socket + suffix + ip);
    }

    private void logDisconnection(ConnectionInfo info) {
        String timestamp = LocalDateTime.now().format(DateTimeFormatter.ofPattern("HH:mm:ss"));
        String ip = colorConverter.style(info.ipAddress, "white", "bold");
        String socket = colorConverter.style(info.socketId, "white", "bold");
        String durationFormatted = info.getFormattedDuration();
        
        String prefix = colorConverter.style(timestamp + " - DISCONNECTED ~ from IP: ", "brightRed", "italic");
        String suffix = colorConverter.style("after " + durationFormatted, "brightRed", "italic");

        System.out.println(
            prefix + ip + 
            colorConverter.style(" (", "brightRed", "italic") + 
            socket + " " + suffix + 
            colorConverter.style(")", "brightRed", "italic")
        );
    }

    public void logUsernameSet(ConnectionInfo info, String user) {
        String timestamp = LocalDateTime.now().format(DateTimeFormatter.ofPattern("HH:mm:ss"));
        String socket = colorConverter.style(info.socketId, "white", "bold");
        String username = colorConverter.style(user, "white", "bold");
        String prefix = colorConverter.style(timestamp + " - USER JOINED: ", "brightBlue", "italic");
        String suffix = colorConverter.style(" with Socket ID: ", "brightBlue", "italic");
        System.out.println(prefix + username + suffix + socket);
    }

    /* 
    ***
    **** NOTIFICATIONS
    *** 
    */
    private void notifyConnectionCallbacks(ConnectionInfo info) {
        for(Consumer<ConnectionInfo> callback : connectionCallbacks) {
            try {
                callback.accept(info);
            } catch(Exception err) {
                System.err.println("Error in connection callback: " + err.getMessage());
            }
        }
    }

    private void notifyDisconnectionCallbacks(ConnectionInfo info) {
        for(Consumer<ConnectionInfo> callback : disconnectionCallbacks) {
            try {
                callback.accept(info);
            } catch(Exception err) {
                System.err.println("Error in disconnection callback: " + err.getMessage());
            }
        }
    }

    /* 
    ***
    **** Socket Id
    *** 
    */
    public String getSocketId(String sessionId) {
        ConnectionInfo connectionInfo = connections.get(sessionId);
        String res = connectionInfo != null ? connectionInfo.socketId : null;
        return res;
    }
}