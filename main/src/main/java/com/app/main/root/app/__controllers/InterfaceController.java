package com.app.main.root.app.__controllers;
import com.app.main.root.app._server.Server;
import com.app.main.root.EnvConfig;
import org.springframework.core.io.ClassPathResource;
import org.springframework.core.io.Resource;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseBody;
import java.lang.management.ManagementFactory;
import java.nio.charset.StandardCharsets;
import java.io.IOException;
import java.util.Date;

@Controller
@RequestMapping("/main")
public class InterfaceController {
    private final Server server;
    private final Date date = new Date();
    private String webUrl = EnvConfig.get("WEB_URL");
    private String serverUrl = EnvConfig.get("SERVER_DEF_HTTP_URL");
    private String apiUrl = EnvConfig.get("API_URL");
    private TimeStreamController timeStreamController;

    public InterfaceController(Server server) {
        this.server = server;
        this.timeStreamController = new TimeStreamController(server);
    }

    @GetMapping("")
    public String main() {
        return "interface";
    }

    @GetMapping("/direct")
    public String direct() {
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
        String path = "com/app/main/root/app/_server/_interface.html";
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
        content = content.replace("{webUrl}", webUrl);
        content = content.replace("{apiGateway}", apiUrl);
        content = content.replace("${serverUrl}", serverUrl);
        return content;
    }
}
