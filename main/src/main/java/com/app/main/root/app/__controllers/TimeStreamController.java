package com.app.main.root.app.__controllers;
import com.app.main.root.app._server.Server;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.HttpMethod;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.ResponseBody;
import org.springframework.web.client.RestTemplate;
import java.util.Date;
import java.util.HashMap;
import java.util.Map;

public class TimeStreamController {
    private final Server server;
    private final RestTemplate restTemplate;
    private String apiUrl = "http://localhost:3002";

    public TimeStreamController(Server server) {
        this.server = server;
        this.restTemplate = new RestTemplate();
    }

    @GetMapping("/api/time-stream")
    @ResponseBody
    public ResponseEntity<Map<String, Object>> getTimeStream() {
        try {
            String url = apiUrl + "/api/time-stream";
            Map<String, Object> timeData = new HashMap<>();
            ResponseEntity<Map<String, Object>> res = 
            restTemplate.exchange(
                url, HttpMethod.GET, null,
                new ParameterizedTypeReference<Map<String, Object>>() {}
            );

            if(res.getStatusCode().is2xxSuccessful() && res.getBody() != null) {
                timeData.putAll(res.getBody());
                timeData.put("source", "api");
            } else {
                timeData.put("local", new Date().toString());
                timeData.put("timestamp", System.currentTimeMillis());
                timeData.put("serverTime", false);
                timeData.put("source", "java-fallback");
            }

            return ResponseEntity.ok(timeData);
        } catch(Exception err) {
            Map<String, Object> fallbackTime = new HashMap<>();
            fallbackTime.put("local", new Date().toString());
            fallbackTime.put("timestamp", System.currentTimeMillis());
            fallbackTime.put("serverTime", false);
            fallbackTime.put("source", "java-error-fallback");
            fallbackTime.put("error", err.getMessage());
            return ResponseEntity.ok(fallbackTime);
        }
    }
}
