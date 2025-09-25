import java.time.LocalDateTime;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArraySet;
import java.util.function.Consumer;

public class ConnectionTracker {
    private static ConnectionTracker instance;
    private final Map<String, ConnectionInfo> connections = new ConcurrentHashMap<>();
    private final Set<Consumer<ConnectionInfo>> connectionCallbacks = new CopyOnWriteArraySet<>();
    private final Set<Consumer<ConnectionInfo>> disconnectionCallbacks = new CopyOnWriteArraySet<>();
    
    public static ConnectionTracker getInstance() {
        if(instance == null) {
            synchronized(ConnectionTracker.class) {
                if(instance == null) {
                    instance = new ConnectionTracker();
                }
            }
        }

        return instance;
    }

    public static class ConnectionInfo {
        public String socketId;
        public String username;
        public String ipAddress;
        public String userAgent;
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
            this.username = "Anonymous";
            this.ipAddress = ipAddress;
            this.userAgent = userAgent;
            this.connectedAt = LocalDateTime.now();
            this.isConnected = true;
            this.groups = new ArrayList<>();
        }
    }

    public void trackConnection(
        String socketId,
        String ipAddress,
        String userAgent
    ) {
        ConnectionInfo connectionInfo = new ConnectionInfo(socketId, ipAddress, userAgent);
        connections.put(socketId, connectionInfo);
        logConnection(connectionInfo);
        notifyConnectionCallbacks(connectionInfo);   
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

    public List<ConnectionInfo> getAllConnections() {
        return new ArrayList<>(connections.values());
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

    }

    private void logDisconnection(ConnectionInfo info) {

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
}