package com.app.main.root.app.__controllers;
import com.app.main.root.app._server.Server;
import org.springframework.core.io.ClassPathResource;
import org.springframework.core.io.Resource;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseBody;
import java.io.File;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;

@Controller
@RequestMapping("/main")
public class ScriptController {
    private final Server server;

    public ScriptController(Server server) {
        this.server = server;
    }

    /**
     * Api Url
     */
    @GetMapping(value = "/public/api-url.js", produces = "application/javascript")
    @ResponseBody
    public ResponseEntity<String> getApiUrl() {
        try {
            File externalFile = new File("/app/src/main/java/com/app/main/root/public/api-url.js");
              if(externalFile.exists()) {
                System.out.println("Serving api-url.js from external file: " + externalFile.getAbsolutePath());
                String content = new String(Files.readAllBytes(externalFile.toPath()), StandardCharsets.UTF_8);
                return ResponseEntity.ok()
                        .contentType(MediaType.valueOf("application/javascript"))
                        .body(content);
            }
            
            System.out.println("External file not found, serving from classpath");
            String content = loadFile("com/app/main/root/public/api-url.js");
            return ResponseEntity.ok()
                    .contentType(MediaType.valueOf("application/javascript"))
                    .body(content);
        } catch(Exception err) {
            System.out.println("Error loading api-url.js: " + err.getMessage());
            err.printStackTrace();
            return ResponseEntity.ok()
                    .contentType(MediaType.TEXT_PLAIN)
                    .body("Failed to load: " + err.getMessage());
        }
    }

    @GetMapping(value = "/public/url.js", produces = "application/javascript")
    @ResponseBody
    public ResponseEntity<String> getUrl() {
        try {
            String content = loadFile("com/app/main/root/public/url.js");
            return ResponseEntity.ok()
                    .contentType(MediaType.valueOf("application/javascript"))
                    .body(content);
        } catch(Exception err) {
            System.out.println(err);
            return ResponseEntity.ok()
                    .contentType(MediaType.TEXT_PLAIN)
                    .body("Failed to load");
        }
    }

    /**
     * Time Updater
     */
    @GetMapping(value = "/public/time-updater.js", produces = "application/javascript")
    @ResponseBody
    public ResponseEntity<String> getTimeUpdater() {
        try {
            String content = loadFile("com/app/main/root/public/time-updater.js");
            return ResponseEntity.ok()
                    .contentType(MediaType.valueOf("application/javascript"))
                    .body(content);
        } catch(Exception err) {
            System.out.println(err);
            return ResponseEntity.ok()
                    .contentType(MediaType.TEXT_PLAIN)
                    .body("Failed to load");
        }
    }

    /**
     * Check Client Status
     */
    @GetMapping(value = "/public/check-client-status.js", produces = "application/javascript")
    @ResponseBody
    public ResponseEntity<String> checkClientStatus() {
        try {
            String content = loadFile("com/app/main/root/public/check-client-status.js");
            return ResponseEntity.ok()
                    .contentType(MediaType.valueOf("application/javascript"))
                    .body(content);
        } catch(Exception err) {
            System.out.println(err);
            return ResponseEntity.ok()
                    .contentType(MediaType.TEXT_PLAIN)
                    .body("Failed to load");
        }
    }

    /**
     * Update Time Status
     */
    @GetMapping(value = "/public/update-time-status.js", produces = "application/javascript")
    @ResponseBody
    public ResponseEntity<String> getUpdateTimeStatus() {
        try {
            String content = loadFile("com/app/main/root/public/update-time-status.js");
            return ResponseEntity.ok()
                    .contentType(MediaType.valueOf("application/javascript"))
                    .body(content);
        } catch(Exception err) {
            System.out.println(err);
            return ResponseEntity.ok()
                    .contentType(MediaType.TEXT_PLAIN)
                    .body("Failed to load");
        }
    }

    /**
     * Update Uptime
     */
    @GetMapping(value = "/public/update-uptime.js", produces = "application/javascript")
    @ResponseBody
    public ResponseEntity<String> getUpdateUptime() {
        try {
            String content = loadFile("com/app/main/root/public/update-uptime.js");
            return ResponseEntity.ok()
                    .contentType(MediaType.valueOf("application/javascript"))
                    .body(content);
        } catch(Exception err) {
            System.out.println(err);
            return ResponseEntity.ok()
                    .contentType(MediaType.TEXT_PLAIN)
                    .body("Failed to load");
        }
    }

    /**
     * Update Uptime
     */
    @GetMapping(value = "/public/update-connections.js", produces = "application/javascript")
    @ResponseBody
    public ResponseEntity<String> getUpdateConnections() {
        try {
            String content = loadFile("com/app/main/root/public/update-connections.js");
            return ResponseEntity.ok()
                    .contentType(MediaType.valueOf("application/javascript"))
                    .body(content);
        } catch(Exception err) {
            System.out.println(err);
            return ResponseEntity.ok()
                    .contentType(MediaType.TEXT_PLAIN)
                    .body("Failed to load");
        }
    }

    /**
     * Server Interface Styles 
     */
    @GetMapping(value = "/styles/interface.css", produces = "text/css")
    @ResponseBody
    public ResponseEntity<String> getServerInterfaceStyles() {
        try {
            String content = loadFile("com/app/main/root/app/main/__styles/interface.css");
            return ResponseEntity.ok()
                    .contentType(MediaType.valueOf("text/css"))
                    .body(content);
        } catch(Exception err) {
            System.out.println(err);
            return ResponseEntity.ok()
                    .contentType(MediaType.TEXT_PLAIN)
                    .body("Failed to load");
        }
    }

    private String loadFile(String path) throws Exception {
        Resource resource = new ClassPathResource(path);
        if(!resource.exists()) throw new Exception("file not found!: " + path);
        return new String(resource.getInputStream().readAllBytes(), StandardCharsets.UTF_8);
    }
}