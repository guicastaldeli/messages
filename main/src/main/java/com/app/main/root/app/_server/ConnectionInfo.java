package com.app.main.root.app._server;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.time.Duration;
import java.util.List;
import ua_parser.*;

public class ConnectionInfo {
    public String socketId;
    public String sessionId;
    public String username;
    public String account;
    public String ipAddress;
    public String userAgent;
    public String device;
    private String deviceType;
    private String deviceBrand;
    private String deviceModel;
    public String browser;
    private String browserVersion;
    public String os;
    private String osVersion;
    public LocalDateTime connectedAt;
    public LocalDateTime disconnectedAt;
    public boolean isConnected;
    public String room;
    public List<String> groups;
    
    private final Parser uaParser = new Parser();

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
        parseUserAgent(userAgent);
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
    * Parse User Agent 
    */
    private void parseUserAgent(String userAgent) {
        if(userAgent == null || userAgent.isEmpty()) System.err.println("User Agent error!");

        try {
            Client client = uaParser.parse(userAgent);
            
            /* Device Info */
            Device deviceInfo = client.device;
            this.deviceBrand = capitalize
        }
    }

    private String capitalize(String str) {
        if(str == null || str.isEmpty()) return "Unknown";
        return str.substring(0, 1).toUpperCase() + str.substring(1).toLowerCase();
    }

    private void setDefaultValues() {
        this.device = "Unknown";
        this.deviceType = "Unknown";
        this.deviceBrand = "Unknown";
        this.deviceModel = "Unknown";
        this.browser = "Unknown";
        this.browserVersion = "Unknown";
        this.os = "Unknown";
        this.osVersion = "Unknown";
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