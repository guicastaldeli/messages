package com.app.main.root.app.__controllers;
import org.springframework.stereotype.Controller;
import com.app.main.root.app._server.ConnectionTracker;

@Controller
public class SocketController {
    private ConnectionTracker connectionTracker;

    public SocketController(ConnectionTracker connectionTracker) {
        this.connectionTracker = connectionTracker;
    }
}
