package com.app.main.root.app._server;
import com.app.main.root.app.__controllers.UserAgentParserController;
import com.app.main.root.app.__controllers.UserAgentParserPrediction;
import org.springframework.stereotype.Component;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.time.Duration;
import java.util.List;

@Component
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
    
    private transient UserAgentParserController userAgentParserController;

    public ConnectionInfo(UserAgentParserController userAgentParserController) {
        this.userAgentParserController = userAgentParserController;
    }

    public static ConnectionInfo create(
        String socketId,
        String ipAddress,
        String userAgent,
        UserAgentParserController userAgentParserController
    ) {
        ConnectionInfo connectionInfo = new ConnectionInfo(userAgentParserController);
        
        connectionInfo.socketId = socketId;
        connectionInfo.sessionId = socketId;
        connectionInfo.username = "Anonymous";
        connectionInfo.account = "Unknown";
        connectionInfo.ipAddress = ipAddress;
        connectionInfo.userAgent = userAgent;
        connectionInfo.parseUserAgent(userAgent);
        connectionInfo.connectedAt = LocalDateTime.now();
        connectionInfo.isConnected = true;
        connectionInfo.groups = new ArrayList<>();

        return connectionInfo;
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
        if(userAgentParserController == null) {
            setDefaultValues();
            return;
        }

        try {
            UserAgentParserPrediction prediction = userAgentParserController.analyze(userAgent);
    
            this.browser = prediction.getBrowser();
            this.os = prediction.getOs();
            this.deviceType = prediction.getDeviceType();
            this.deviceBrand = prediction.getDeviceBrand();
            this.detectionConfidence = prediction.getConfidence();
            this.detectionMethod = "API AI UAP";
            this.reasoning = prediction.getReasoning();
        } catch(Exception err) {
            System.err.println("Analysis failed: " + err.getMessage());
            setDefaultValues();
        }
        //REMINDER: Extract Versions (OS, Browser, etc, later...)
    }

    private String capitalize(String str) {
        if(str == null || str.isEmpty()) return "Unknown **Capitalize";
        return str.substring(0, 1).toUpperCase() + str.substring(1).toLowerCase();
    }

    private void setDefaultValues() {
        String msg = "Unknown **Fallback Connection Info";

        this.browser = msg;
        this.os = msg;
        this.deviceType = msg;
        this.deviceBrand = msg;
        this.device = msg;
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
                    browser='%s',
                    os='%s',
                    deviceType='%s',
                    deviceBrand='%s',
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
            browser,
            os,
            deviceType,
            deviceBrand,
            connectedAt,
            isConnected,
            getFormattedDuration()
        );
    }
}