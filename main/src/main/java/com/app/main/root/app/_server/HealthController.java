package com.app.main.root.app._server;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;
import java.util.Map;

@RestController
public class HealthController {
    private final ConnectionTracker connectionTracker;
    private final LoadBalancer loadBalancer;
    
    public HealthController(ConnectionTracker connectionTracker, LoadBalancer loadBalancer) {
        this.connectionTracker = connectionTracker;
        this.loadBalancer = loadBalancer;
    }
    
    @GetMapping("/health")
    public String health() {
        return "OK";
    }
    
    @GetMapping("/health/detailed")
    public Map<String, Object> detailedHealth() {
        return Map.of(
            "status", "OK",
            "connections", connectionTracker.getActiveConnectionsCount(),
            "loadBalancer", loadBalancer.getStats(),
            "timestamp", System.currentTimeMillis()
        );
    }
}