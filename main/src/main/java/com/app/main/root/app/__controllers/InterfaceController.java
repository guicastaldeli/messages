package com.app.main.root.app.__controllers;
import com.app.main.root.app._server.Server;
import java.lang.management.ManagementFactory;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.GetMapping;
import java.util.Date;

@Controller
public class InterfaceController {
    private final Server server;
    private final Date date = new Date();

    public InterfaceController(Server server) {
        this.server = server;
    }

    @GetMapping("/")
    public String getInterface(Model model) {
        model.addAttribute("welcome", "Welcome to Server! :)");
        model.addAttribute("version", "v1.0");
        model.addAttribute("serverTime", System.currentTimeMillis());
        model.addAttribute("currentTime", date);
        model.addAttribute("connections", server.getConnectionTracker().getConnectionsCount());
        model.addAttribute("update", ManagementFactory.getRuntimeMXBean().getUptime() / 1000);
        
        return "interface";
    }
}
