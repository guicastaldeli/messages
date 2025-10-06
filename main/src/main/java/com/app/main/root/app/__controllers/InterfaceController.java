package com.app.main.root.app.__controllers;
import com.app.main.root.app._server.Server;
import org.springframework.core.io.ClassPathResource;
import org.springframework.core.io.Resource;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.ResponseBody;
import java.lang.management.ManagementFactory;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.Date;

@Controller
public class InterfaceController {
    private final Server server;
    private final Date date = new Date();

    public InterfaceController(Server server) {
        this.server = server;
    }

    @GetMapping("/")
    public String index() {
        return "interface";
    }

    @GetMapping("/interface")
    @ResponseBody
    public ResponseEntity<String> getInterface() {
        try {
            String content = loadInterface();
            content = getData(content);
            return ResponseEntity.ok()
                    .contentType(MediaType.TEXT_HTML)
                    .body(content);
        } catch(IOException err) {
            return ResponseEntity.internalServerError()
                    .body("Error loading interface..." + err.getMessage());
        }
    }

    private String loadInterface() throws IOException {
        String path = "com/app/main/root/app/_server/interface.html";
        Resource resource = new ClassPathResource(path);
        if(!resource.exists()) throw new IOException("Interface file not found " + path);
        return new String(resource.getInputStream().readAllBytes(), StandardCharsets.UTF_8);
    }

    private String getData(String content) {
        int connections = 
        server.getConnectionTracker() != null ?
        server.getConnectionTracker().getConnectionsCount() : 0;
        long uptime = ManagementFactory.getRuntimeMXBean().getUptime() / 1000;
        
        content = content.replace("${connections}", String.valueOf(connections));
        content = content.replace("${uptime}", String.valueOf(uptime));
        content = content.replace("${currentTime}", new java.util.Date().toString());
        return content;
    }
}
