package com.app.main.root.app._server;
import org.springframework.stereotype.Component;
import com.app.main.root.EnvConfig;

@Component
public class ServerInstance {
    private static final String SERVER_ID = EnvConfig.get("MAIN_SERVER_ID");
    private static final String ENV_SERVER_URL = EnvConfig.get("SERVER_URL");

    private final String serverId;
    private final String url;
    private int activeConnections;
    private boolean healthy;
    private long lastHealthCheck;

    public ServerInstance() {
        this.serverId = SERVER_ID;
        this.url = ENV_SERVER_URL;
        this.healthy = true;
        this.lastHealthCheck = System.currentTimeMillis();
    }
    public ServerInstance(String serverId, String url) {
        this.serverId = serverId;
        this.url = url;
        this.healthy = true;
        this.lastHealthCheck = System.currentTimeMillis();
    }

    /**
     * Server Id
     */
    public String getServerId() {
        return serverId;
    }

    /**
     * Url
     */
    public String getUrl() {
        return url;
    }

    /**
     * Health
     */
    public boolean isHealthy() {
        return healthy;
    }

    public void setHealthy(boolean healthy) {
        this.healthy = healthy;
    }

    public void setLastHealthCheck(long time) {
        this.lastHealthCheck = time;
    }

    /**
     * Connections
     */
    public int getActiveConnections() {
        return activeConnections;
    }

    public void incrementConnections() {
        activeConnections++;
    }

    public void decrementConnections() {
        activeConnections--;
    }
}
