package com.app.main.root.app._server;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;
import java.util.concurrent.ConcurrentHashMap;
import java.util.*;

@Service
public class HealthCheckService {
    private final LoadBalancer loadBalancer;
    private final RestTemplate restTemplate;
    private final Map<String, Integer> failureCounts = new ConcurrentHashMap<>();
    private static final int MAX_FAILURES = 3;
    
    public HealthCheckService(LoadBalancer loadBalancer) {
        this.loadBalancer = loadBalancer;
        this.restTemplate = new RestTemplate();
    }

    @Scheduled(fixedRate = 30000)
    public void performHealthChecks() {
        Map<String, Object> stats = loadBalancer.getStats();
        if(stats != null) {
            Map<String, ServerInstance> serverDetails = (Map<String, ServerInstance>) stats.get("serverDetails");
            if(serverDetails != null) {
                for(Map.Entry<String, ServerInstance> entry : serverDetails.entrySet()) {
                    String serverId = entry.getKey();
                    ServerInstance server = entry.getValue();
                    try {
                        String healthUrl = server.getUrl() + "/health";
                        String res = restTemplate.getForObject(healthUrl, String.class);
                        if("OK".equals(res)) {
                            loadBalancer.updateServerHealth(serverId, true);
                            failureCounts.remove(serverId);
                        } else {
                            handleServerFailure(serverId);
                        }
                    } catch(Exception err) {
                        System.out.println(err);
                        handleServerFailure(serverId);
                    }
                }
            }
        }
    }

    private void handleServerFailure(String serverId) {
        int failures = failureCounts.getOrDefault(serverId, 0) + 1;
        failureCounts.put(serverId, failures);
        if(failures >= MAX_FAILURES) {
            loadBalancer.updateServerHealth(serverId, false);
            System.err.println("Server " + serverId + " marked as unhealthy after " + failures + " failures");
        }
    }
}
