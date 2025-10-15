package com.app.main.root.app._server;
import java.time.LocalDateTime;
import java.util.List;
import java.util.ArrayList;
import java.time.Duration;

public class ConnectionInfo {
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
        return "TEST";
    } 

    /*
    * Browser 
    */
    private String extractBrowser(String userAgent) {
        return "TEST";
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