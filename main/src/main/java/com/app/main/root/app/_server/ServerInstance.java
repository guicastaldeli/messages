package com.app.main.root.app._server;

public class ServerInstance {
    private final String serverId;
    private final String url;
    private int activeConnections;
    private boolean healthy;
    private long lastHealthCheck;

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
