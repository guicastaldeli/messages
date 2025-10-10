package com.app.main.root.app.__controllers;
import com.app.main.root.app._service.SessionService;
import org.springframework.web.bind.annotation.*;
import java.util.*;

@RestController
@RequestMapping("/api/session")
public class SessionController {
    private final SessionService service;

    public SessionController(SessionService service) {
        this.service = service;
    }

    @PostMapping("/update")
    public Map<String, Object> updateSession(
        @RequestParam String userId,
        @RequestBody String username,
        @RequestBody String sessionType
    ) {
        SessionService.SessionType type = SessionService.SessionType.valueOf(sessionType.toUpperCase());
        service.updateUserSession(userId, username, type);
        SessionService.SessionData sessionData = service.getSession(userId);
        return createSessionResponse(sessionData);
    }

    @PutMapping("/{userId}/type")
    public Map<String, Object> updateSessionType(
        @PathVariable String userId,
        @RequestParam String sessionType
    ) {
        SessionService.SessionType type = SessionService.SessionType.valueOf(sessionType.toUpperCase());
        service.updateSessionType(userId, type);
        SessionService.SessionData sessionData = service.getSession(userId);
        if(sessionData == null) {
            return Map.of("error", "User session not found");
        }
        return createSessionResponse(sessionData);
    }

    @GetMapping("/{userId}")
    public Map<String, Object> getSession(@PathVariable String userId) {
        SessionService.SessionData sessionData = service.getSession(userId);
        if(sessionData == null) {
            return Map.of("error", "Session not found");
        }
        return createSessionResponse(sessionData);
    }

    @GetMapping("/active")
    public Map<String, Object> getActiveSessions() {
        Map<String, SessionService.SessionData> sessions = service.getActiveSessions();
        Map<String, Object> res = new HashMap<>();
        sessions.forEach((userId, sessionData) -> {
            res.put(userId, createSessionResponse(sessionData));
        });
        return res;
    }

    @GetMapping("/stats")
    public Map<String, Object> getSessionStats() {
        Map<SessionService.SessionType, Long> stats = service.getSessionStats();
        Map<String, Object> res = new HashMap<>();
        
        stats.forEach((type, count) -> {
            res.put(type.name().toLowerCase(), count);
        });

        res.put("total", stats.values().stream().mapToLong(Long::longValue).sum());
        res.put("timestamp", System.currentTimeMillis());
        return res;
    }

    private Map<String, Object> createSessionResponse(SessionService.SessionData sessionData) {
        return Map.of(
            "currentSession", sessionData.getCurrentSession().name(),
            "userId", sessionData.getUserId(),
            "username", sessionData.getUsername(),
            "lastActivity", sessionData.getLastActivity()
        );
    }
}
