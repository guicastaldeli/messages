package com.app.main.root.app.__controllers;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import com.app.main.root.app._server.ConnectionTracker;
import com.app.main.root.app._server.ConnectionTracker.ConnectionInfo;
import java.util.List;
import java.util.Map;

@RequestMapping("/connections")
public class ConnectionController {
    @Autowired
    private ConnectionTracker connectionTracker;

    public ConnectionController() {
        System.out.println("Connection Controller running!!!!");
    }

    @GetMapping("/socket-id")
    public Map<String, String> getSocketId(@RequestParam String username) {
        String socketId = connectionTracker.getSocketId(username);
        String returnSocket = socketId != null ? socketId : "not-found";
        System.out.println(username);
        return Map.of("socketId", returnSocket);
    }

    @GetMapping("/active/sockets")
    public List<String> getActiveSocketIds() {
        return connectionTracker.getActiveSocketIds();
    }

    @GetMapping("/connections/{socketId}")
    public ConnectionInfo getConnectionInfo(@PathVariable String socketId) {
        System.out.println(socketId);
        return connectionTracker.getConnection(socketId);
    }
}
