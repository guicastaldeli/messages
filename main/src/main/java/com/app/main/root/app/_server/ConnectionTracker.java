package com.app.main.root.app._server;
import com.app.main.root.app.__controllers.UserAgentParserController;
import com.app.main.root.app._service.ServiceManager;
import com.app.main.root.app._utils.ColorConverter;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Lazy;
import org.springframework.stereotype.Component;
import jakarta.servlet.http.HttpServletRequest;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArraySet;
import java.util.function.Consumer;
import java.util.*;

@Component
public class ConnectionTracker {
    private final Map<String, ConnectionInfo> connections = new ConcurrentHashMap<>();
    private final Set<Consumer<ConnectionInfo>> connectionCallbacks = new CopyOnWriteArraySet<>();
    private final Set<Consumer<ConnectionInfo>> disconnectionCallbacks = new CopyOnWriteArraySet<>();

    @Autowired private LoadBalancer loadBalancer;
    @Autowired private ServerInstance serverInstance;
    @Autowired private SessionAffinityService sessionAffinityService;
    @Autowired private ColorConverter colorConverter;
    @Autowired private UserAgentParserController userAgentParserController;
    @Autowired @Lazy public ServiceManager serviceManager;

    /**
     * Track Connection 
     */
    public void trackConnection(
        String socketId,
        String ipAddress,
        String userAgent
    ) {
        ConnectionInfo connectionInfo = ConnectionInfo.create(
            socketId, 
            ipAddress, 
            userAgent, 
            userAgentParserController
        );
        connectionInfo.isConnected = true;
        connections.put(socketId, connectionInfo);

        ServerInstance server = loadBalancer.getLeastLoadedServer();
        if(server != null) {
            sessionAffinityService.assignServerToSession(socketId, server.getServerId());
            connectionInfo.serverId = server.getServerId();
        }
        
        logConnection(connectionInfo);
        notifyConnectionCallbacks(connectionInfo);
        System.out.println(connectionInfo.toString());
    }

    /**
     * Track Disconnection 
     */
    public void trackDisconnection(String socketId) {
        ConnectionInfo connectionInfo = connections.get(socketId);
        if(connectionInfo != null) {
            connectionInfo.disconnectedAt = LocalDateTime.now();
            connectionInfo.isConnected = false;

            sessionAffinityService.removeSession(socketId);

            String userId = serviceManager.getUserService().getUserIdBySession(socketId);
            if(userId != null) {
                serviceManager.getGroupService().removeUserFromAllGroups(userId);
                serviceManager.getUserService().unlinkUserSession(socketId);
            }

            logDisconnection(connectionInfo);
            notifyDisconnectionCallbacks(connectionInfo);
        }
    }

    /**
     * Update Username 
     */
    public void updateUsername(String socketId, String userId, String username) {
        ConnectionInfo connectionInfo = connections.get(socketId);
        if(connectionInfo != null) {
            connectionInfo.username = username;
            connectionInfo.userId = userId;
            
            serviceManager.getUserService().linkUserSession(userId, socketId);
            serviceManager.getGroupService().updateGroupSessionsUser(userId, socketId);
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

    /**
     * Group Sessions
     */
    public Set<String> getGroupSessions(String groupId) {
        return serviceManager.getGroupService().groupSessions.getOrDefault(groupId, Collections.emptySet());
    }

    /**
     * Get All Active Sessions 
     */
    public Set<String> getAllActiveSessions() {
        Set<String> activeSessions = new HashSet<>();
        for(ConnectionInfo conn : connections.values()) {
            if(conn.isConnected) {
                activeSessions.add(conn.socketId);
            }
        }
        return activeSessions;
    }

    /**
     * Get Ip 
     */
    public String getClientIpAddress(HttpServletRequest request) {
        String xForwardedFor = request.getHeader("X-Forwarded-For");
        if(xForwardedFor != null && xForwardedFor.isEmpty()) {
            return xForwardedFor.split(",")[0].trim();
        }

        String xRealIp = request.getHeader("X-Real-IP");
        if(xRealIp != null && !xRealIp.isEmpty()) {
            return xRealIp;
        }

        return request.getRemoteAddr();
    }

    /**
     * Connection Stats 
     */
    public Map<String, Object> getConnectionStats() {
        Map<String, Object> stats = new HashMap<>();
        stats.put("totalConnections", connections.size());
        stats.put("activeConnections", getActiveConnectionsCount());
        stats.put("totalGroups", serviceManager.getGroupService().groupSessions.size());
        stats.put("totalUsers", serviceManager.getUserService().userToSessionMap.size());

        Map<String, Integer> groupSizes = new HashMap<>();
        for(Map.Entry<String, Set<String>> entry : serviceManager.getGroupService().groupSessions.entrySet()) {
            groupSizes.put(entry.getKey(), entry.getValue().size());
        }
        stats.put("groupSizes", groupSizes);

        return stats;
    }

    /**
     * 
     * Socket Id
     * 
     */
    public String getSocketId(String sessionId) {
        ConnectionInfo connectionInfo = connections.get(sessionId);
        String res = connectionInfo != null ? connectionInfo.socketId : null;
        return res;
    }

    /**
     * 
     * Logs
     * 
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

    /**
     * 
     * Notifications
     * 
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