package com.app.main.root.app._server;
import org.springframework.stereotype.Service;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Service
public class SessionAffinityService {
    private final Map<String, String> sessionToServerMap = new ConcurrentHashMap<>();
    private final LoadBalancer loadBalancer;

    public SessionAffinityService(LoadBalancer loadBalancer) {
        this.loadBalancer = loadBalancer;
    }

    public String getServerForSession(String sessionId) {
        return sessionToServerMap.get(sessionId);
    }

    /**
     * Assign Server to Session
     */
    public void assignServerToSession(String sessionId, String serverId) {
        sessionToServerMap.put(sessionId, serverId);
        ServerInstance server = 
            loadBalancer
            .getStats()
            .get("serverDetails").get(serverId);
        if(server != null) {
            server.incrementConnections();
        }
    }

    /**
     * Remove Session
     */
    public void removeSession(String sessionId) {
        String serverId = sessionToServerMap.remove(sessionId);
        if(serverId != null) {
            ServerInstance server = 
                loadBalancer.
                getStats()
                .get("serverDetails").get(serverId);
            if(server != null) {
                server.decrementConnections();
            }
        }
    }
}
