package com.app.main.root.app._auth;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import com.app.main.root.EnvConfig;
import com.app.main.root.app._service.ServiceManager;
import java.util.Map;
import java.util.HashMap;
import java.util.*;

@Service
public class SyncAuthService {
    private final RestTemplate restTemplate = new RestTemplate();
    private final ServiceManager serviceManager;

    private final static String WEB_URL = EnvConfig.get("WEB_URL");
    private final static String DRIVE_SERVICE_API_URL = EnvConfig.get("DRIVE_SERVICE_API_URL");

    public SyncAuthService(ServiceManager serviceManager) {
        this.serviceManager = serviceManager;
    }

    /**
     * Register
     */
    public Map<String, Object> resgisterUser(
        String username,
        String email,
        String password,
        String sessionId,
        String ipAddress
    ) {
        Map<String, Object> res = new HashMap<>();

        try {
            Map<String, Object> localRes = 
                serviceManager
                    .getUserService()
                    .registerUser(
                        username,
                        email,
                        password,
                        sessionId,
                        ipAddress
                    );

            Map<String, Object> req = new HashMap<>();
            req.put("username", username);
            req.put("email", email);
            req.put("password", password);
            req.put("sourceService", "messages");

            Map<String, Object> appRes = restTemplate.postForObject(
                DRIVE_SERVICE_API_URL + "/api/auth/sync-register",
                req,
                Map.class
            );

            res.putAll(localRes);
            res.put("driveService", appRes);
            res.put("success", true);
        } catch(Exception err) {
            res.put("success", false);
            res.put("error", err.getMessage());
        }

        return res;
    }

    /**
     * Login
     */
    public Map<String, Object> loginUser(
        String email,
        String password,
        String sessionId,
        String ipAddress
    ) {
        Map<String, Object> res = new HashMap<>();

        try {
            Map<String, Object> localRes = 
                serviceManager
                    .getUserService()
                    .loginUser(
                        email,
                        password,
                        sessionId,
                        ipAddress
                    );

            Map<String, Object> req = new HashMap<>();
            req.put("email", email);
            req.put("password", password);
            req.put("sessionId", sessionId);
            
            Map<String, Object> appRes = restTemplate.postForObject(
                DRIVE_SERVICE_API_URL + "/api/auth/sync-login",
                req,
                Map.class
            );
            
            res.putAll(localRes);
            res.put("driveService", appRes);
            res.put("success", true);
        } catch(Exception err) {
            res.put("success", false);
            res.put("error", err.getMessage());
        }

        return res;
    }

    
}
