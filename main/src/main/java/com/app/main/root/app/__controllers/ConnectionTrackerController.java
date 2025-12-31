package com.app.main.root.app.__controllers;
import com.app.main.root.app._server.ConnectionTracker;
import com.app.main.root.app._server.ConnectionInfo;
import org.springframework.web.bind.annotation.*;
import java.util.List;
import java.util.Map;
import java.util.ArrayList;

@RestController
@RequestMapping("/api/connection-tracker")
public class ConnectionTrackerController {
    private final ConnectionTracker connectionTracker;

    public ConnectionTrackerController(ConnectionTracker connectionTracker) {
        this.connectionTracker = connectionTracker;
    }

    /*
    * All Connections 
    */
    @GetMapping("/connections/all")
    public Map<String, ConnectionInfo> getAllConnections() {
        return connectionTracker.getAllConnections();
    }

    /*
    * Active Connections 
    */
    @GetMapping("/connections/active")
    public List<ConnectionInfo> getActiveConnections() {
        return connectionTracker.getActiveConnections();
    }

    /*
    * Connection by Socket Id 
    */
    @GetMapping("/connections/{socketId}")
    public ConnectionInfo getConnectionSocketId(@PathVariable String socketId) {
        ConnectionInfo conn = connectionTracker.getConnection(socketId);
        if(conn == null) throw new RuntimeException("Connection not found");
        return conn;
    }

    /*
    * Connection by Ip 
    */
    @GetMapping("/connections/ip/{ipAddress}")
    public List<ConnectionInfo> getConnectionIp(@PathVariable String ipAddress) {
        Map<String, ConnectionInfo> conn = connectionTracker.getAllConnections();
        List<ConnectionInfo> connIp = new ArrayList<>();
        for(ConnectionInfo c : conn.values()) {
            if(ipAddress.equals(c.ipAddress)) {
                connIp.add(c);
            }
        }
        return connIp;
    }

    /*
    * Connections by Username  
    */
    @GetMapping("/connections/user/{username}")
    public List<ConnectionInfo> getConnectionsByUsername(@PathVariable String username) {
        Map<String, ConnectionInfo> conns = connectionTracker.getAllConnections();
        List<ConnectionInfo> connsUser = new ArrayList<>();
        for(ConnectionInfo conn : conns.values()) {
            if(username.equalsIgnoreCase(conn.username)) {
                connsUser.add(conn);
            }
        } 
        return connsUser;
    }

    /*
    * Update Username 
    */
    @PutMapping("/connections/{socketId}/username/{username}")
    public ConnectionInfo updateUsername(
        @PathVariable String socketId,
        @PathVariable String userId,
        @PathVariable String username
    ) {
        connectionTracker.updateUsername(socketId, userId, username);
        ConnectionInfo conn = connectionTracker.getConnection(socketId);
        if(conn == null) throw new RuntimeException("Connection not found!");
        return conn;
    }

    /*
    * Count 
    */
    @GetMapping("/count")
    public int getConnectionsCount() {
        return connectionTracker.getConnectionsCount();
    }

    /*
    * Track Connection
    */
    @PostMapping("/connections/track")
    public ConnectionInfo trackConnection(
        @RequestParam String socketId,
        @RequestParam String ipAddress,
        @RequestParam(defaultValue = "") String userAgent
    ) {
        connectionTracker.trackConnection(socketId, ipAddress, userAgent);
        return connectionTracker.getConnection(socketId);
    }

    /*
    * Clear 
    */
    @DeleteMapping("/connections/clear")
    public String clearConnections() {
        return "Add clear later...";
    }
}
