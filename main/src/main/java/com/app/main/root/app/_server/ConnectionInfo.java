package com.app.main.root.app._server;
import com.app.main.root.app.__controllers.UserAgentParserController;
import com.app.main.root.app.__controllers.UserAgentParserPrediction;

import org.springframework.beans.factory.annotation.Autowired;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.time.Duration;
import java.util.List;

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
    private double detectionConfidence;
    private String detectionMethod;
    private String reasoning;
    public LocalDateTime connectedAt;
    public LocalDateTime disconnectedAt;
    public boolean isConnected;
    public String room;
    public List<String> groups;
    
    @Autowired
    private transient UserAgentParserController userAgentParserController;

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
        if(userAgentParserController == null) userAgentParserController = new UserAgentParserController();
        UserAgentParserPrediction prediction = userAgentParserController.analyze(userAgent);

        this.browser = prediction.getBrowser();
        this.os = prediction.getOs();
        this.deviceType = prediction.getDeviceType();
        this.deviceBrand = prediction.getDeviceBrand();
        this.detectionConfidence = prediction.getConfidence();
        this.detectionMethod = "API AI UAP";
        this.reasoning = prediction.getReasoning();
        //REMINDER: Extract Versions (OS, Browser, etc, later...)
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