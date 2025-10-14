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
import java.nio.charset.StandardCharsets;

@Controller
@RequestMapping("/main")
public class ScriptController {
    private final Server server;

    public ScriptController(Server server) {
        this.server = server;
    }

    /*
    * Api Url
    */
    @GetMapping(value = "/public/api-url.js", produces = "application/javascript")
    @ResponseBody
    public ResponseEntity<String> getApiUrl() {
        try {
            String content = loadFile("com/app/main/root/public/api-url.js");
            return ResponseEntity.ok()
                    .contentType(MediaType.valueOf("application/javascript"))
                    .body(content);
        } catch(Exception e) {
            System.out.println(e);
            return ResponseEntity.ok()
                    .contentType(MediaType.TEXT_PLAIN)
                    .body("Failed to load");
        }
    }

    /*
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
        } catch(Exception e) {
            System.out.println(e);
            return ResponseEntity.ok()
                    .contentType(MediaType.TEXT_PLAIN)
                    .body("Failed to load");
        }
    }

    /*
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
        } catch(Exception e) {
            System.out.println(e);
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
