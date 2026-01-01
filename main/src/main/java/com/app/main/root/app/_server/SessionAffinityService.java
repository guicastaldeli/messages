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
        Map<String, Object> stats = loadBalancer.getStats();
        if(stats != null) {
            Map<String, ServerInstance> serverDetails = (Map<String, ServerInstance>) stats.get("serverDetails");
            if(serverDetails != null) {
                ServerInstance server = serverDetails.get(serverId);
                if(server != null) {
                    server.incrementConnections();
                }
            }
        }
    }

    /**
     * Remove Session
     */
    public void removeSession(String sessionId) {
        String serverId = sessionToServerMap.remove(sessionId);
        Map<String, Object> stats = loadBalancer.getStats();
        if(stats != null) {
            Map<String, ServerInstance> serverDetails = (Map<String, ServerInstance>) stats.get("serverDetails");
            if(serverDetails != null) {
                ServerInstance server = serverDetails.get(serverId);
                if(server != null) {
                    server.decrementConnections();
                }
            }
        }
    }
}
