package com.app.main.root.app._server;
import com.app.main.root.EnvConfig;
import jakarta.annotation.PostConstruct;
import org.springframework.stereotype.Component;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.*;

@Component
public class LoadBalancer {
    private static final String SERVER_ID = EnvConfig.get("MAIN_SERVER_ID");
    private static final String SERVER_URL = EnvConfig.get("SERVER_URL");
    private static final String DEFAULT_URL = EnvConfig.get("DEFAULT_URL");

    private final Map<String, ServerInstance> serverInstances = new ConcurrentHashMap<>();
    private final AtomicInteger currentIndex = new AtomicInteger(0);
    private final List<String> serverList = new ArrayList<>();

    @PostConstruct
    public void init() {
        String instances = EnvConfig.get("SERVER_INSTANCES");
        System.out.println("DEBUG: SERVER_INSTANCES from EnvConfig: '" + instances + "'");
        if(instances != null && !instances.isEmpty()) {
            String[] serverConfigs = instances.split(",");
            for(String config : serverConfigs) {
                String[] parts = config.split(":");
                if(parts.length == 2) {
                    String serverId = parts[0];
                    String port = parts[1];
                    String url = DEFAULT_URL + ":" + port;
                    registerServer(serverId, url);
                    System.out.println("Registered server: " + serverId + " at " + url);
                }
            }
        }

        registerServer(SERVER_ID, SERVER_URL);
        System.out.println("Total servers registered: " + serverInstances.size());
    }

    /**
     * Register Server
     */
    public void registerServer(String serverId, String url) {
        ServerInstance instance = new ServerInstance(serverId, url);
        serverInstances.put(serverId, instance);
        serverList.add(serverId);
        System.out.println("Registered server: " + serverId + " at " + url);
    }

    /**
     * Unregister Server
     */
    public void unregisterServer(String serverId) {
        serverInstances.remove(serverId);
        serverList.remove(serverId);
        System.out.println("Unregistered server: " + serverId);
    }

    /**
     * Get Next Server
     */
    public ServerInstance getNextServer() {
        if(serverList.isEmpty()) return null;

        int i = currentIndex.getAndIncrement() % serverList.size();
        String serverId = serverList.get(i);
        return serverInstances.get(serverId);
    }

    /**
     * Least Loaded Server
     */
    public ServerInstance getLeastLoadedServer() {
        return serverInstances.values().stream()
            .filter(ServerInstance::isHealthy)
            .min(Comparator.comparingInt(ServerInstance::getActiveConnections))
            .orElse(null);
    }

    /**
     * Update Server Health
     */
    public void updateServerHealth(String serverId, boolean healthy) {
        ServerInstance instance = serverInstances.get(serverId);
        if(instance != null) {
            instance.setHealthy(healthy);
            instance.setLastHealthCheck(System.currentTimeMillis());
        }
    }

    public Map<String, Object> getStats() {
        Map<String, Object> stats = new HashMap<>();
        stats.put("totalServers", serverInstances.size());
        stats.put("healthyServers", 
            serverInstances.values().stream()
            .filter(ServerInstance::isHealthy).count()
        );
        stats.put("serverDetails", serverInstances);
        return stats;
    }
}
