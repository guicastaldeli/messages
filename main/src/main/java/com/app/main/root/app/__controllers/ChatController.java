package com.app.main.root.app.__controllers;
import com.app.main.root.app._service.ServiceManager;
import com.app.main.root.app._service.SessionService;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpSession;
import com.app.main.root.app._cache.CacheService;
import org.springframework.web.bind.annotation.*;
import org.springframework.context.annotation.Lazy;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import java.util.*;

@RestController
@RequestMapping("/api/chat")
public class ChatController {
    private final ServiceManager serviceManager;
    private final CacheService cacheService;

    public ChatController(@Lazy ServiceManager serviceManager, CacheService cacheService) {
        this.serviceManager = serviceManager;
        this.cacheService = cacheService;
    }

    private String getAuthenticatedUserId(HttpServletRequest request) {
        String sessionId = serviceManager.getSessionService().extractSessionId(request);
        if(sessionId == null) {
            throw new SecurityException("No session ID found");
        }
        
        if(!serviceManager.getSessionService().validateSession(sessionId)) {
            throw new SecurityException("Invalid or expired session");
        }
        
        SessionService.SessionData sessionData = serviceManager.getSessionService().getSession(sessionId);
        if(sessionData == null) {
            throw new SecurityException("Session data not found");
        }
        
        return sessionData.getUserId();
    }

    private String extractUserIdFromCookies(HttpServletRequest request) {
        Cookie[] cookies = request.getCookies();
        if(cookies != null) {
            //System.out.println("DEBUG - Found " + cookies.length + " cookies");
            
            String[] cookieNames = {"USER_INFO", "userId", "user_id", "AUTH_USER"};
            
            for(Cookie cookie : cookies) {
                //System.out.println("DEBUG - Cookie: " + cookie.getName() + " = " + cookie.getValue());
                
                for(String cookieName : cookieNames) {
                    if(cookieName.equals(cookie.getName())) {
                        try {
                            String value = cookie.getValue();
                            
                            if(cookieName.equals("USER_INFO")) {
                                String[] parts = value.split(":");
                                if(parts.length >= 2) {
                                    String userId = parts[1];
                                    //System.out.println("DEBUG - Extracted userId from USER_INFO: " + userId);
                                    return userId;
                                }
                            } else {
                                System.out.println("DEBUG - Found direct userId in cookie: " + value);
                                return value;
                            }
                        } catch(Exception e) {
                            System.err.println("DEBUG - Error parsing cookie " + cookieName + ": " + e.getMessage());
                        }
                    }
                }
            }
        } else {
            System.out.println("DEBUG - No cookies found in request");
        }
        return null;
    }

    /**
     * Get Chat Data
     */
    @GetMapping("/{chatId}/data")
    public ResponseEntity<?> getChatData(
        @PathVariable String chatId,
        @RequestParam String userId,
        @RequestParam(defaultValue = "0") int page,
        @RequestParam(defaultValue = "20") int pageSize,
        HttpServletRequest request
    ) {
        try {
            String authenticatedUserId = getAuthenticatedUserId(request);
            if(!authenticatedUserId.equals(userId)) {
                return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(Map.of(
                        "error", "User ID mismatch",
                        "message", "You can only access your own chat data"
                    ));
            }
            
            // Additional validation
            if(!serviceManager.getChatService().userHasAccessToChat(authenticatedUserId, chatId)) {
                return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(Map.of("error", "Access denied to this chat"));
            }
        
            //System.out.println("DEBUG - Requested userId: " + userId);
            //System.out.println("DEBUG - Authenticated userId: " + authenticatedUserId);
            /*
            System.out.println("DEBUG - Session ID from cookies: " + 
                serviceManager.getSessionService().extractSessionId(request));
                */
            if(authenticatedUserId == null || !authenticatedUserId.equals(userId)) {
                /*
                System.out.println("DEBUG - Authentication failed: " + 
                    (authenticatedUserId == null ? "No authenticated user" : "User ID mismatch"));
                    */
                return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(Map.of(
                        "error", "Unauthorized access",
                        "message", "You can only access your own chat data",
                        "requestedUserId", userId,
                        "authenticatedUserId", authenticatedUserId != null ? authenticatedUserId : "none"
                    ));
            }
            
            if(!serviceManager.getChatService().userHasAccessToChat(authenticatedUserId, chatId)) {
                return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(Map.of(
                        "error", "Access denied",
                        "message", "You don't have access to this chat"
                    ));
            }
            
            Map<String, Object> data = serviceManager.getChatService().getChatData(
                authenticatedUserId, 
                chatId, 
                page, 
                pageSize
            );
            
            if(data == null) {
                data = new HashMap<>();
            }

            if(data.get("timeline") == null) {
                data.put("timeline", new ArrayList<>());
            }
            if(data.get("messages") == null) {
                data.put("messages", new ArrayList<>());
            }
            if(data.get("files") == null) {
                data.put("files", new ArrayList<>());
            }
                
            Map<String, Object> response = new HashMap<>();
            response.put("chatId", chatId);
            response.put("data", data);
            response.put("success", true);
                
            return ResponseEntity.ok(response);
        } catch(Exception err) {
            err.printStackTrace();
            Map<String, Object> errRes = new HashMap<>();
            errRes.put("chatId", chatId);
            errRes.put("error", err.getMessage());
            errRes.put("success", false);
            return ResponseEntity.status(500).body(errRes);
        }
    }

    /**
     * Clear Chat Cache
     */
    @DeleteMapping("/{chatId}/cache")
    public ResponseEntity<?> clearChatCache(
        @PathVariable String chatId,
        @RequestParam String userId,
        HttpServletRequest request
    ) {
        try {
            String authenticatedUserId = getAuthenticatedUserId(request);
            
            if(authenticatedUserId == null || !authenticatedUserId.equals(userId)) {
                return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(Map.of(
                        "success", false,
                        "error", "Unauthorized access"
                    ));
            }
            
            cacheService.invalidateChatCache(authenticatedUserId, chatId);
            return ResponseEntity.ok(Map.of(
                "success", true,
                "message", "Cache cleared for chat " + chatId
            ));
        } catch(Exception err) {
            return ResponseEntity.status(500).body(Map.of(
                "success", false,
                "error", err.getMessage()
            ));
        }
    }

    /**
     * Get Cache Stats
     */
    @GetMapping("/cache/stats")
    public ResponseEntity<?> getCacheStats() {
        try {
            Map<String, Object> stats = cacheService.getCacheStats();
            return ResponseEntity.ok(Map.of(
                "success", true,
                "stats", stats
            ));
        } catch(Exception err) {
            return ResponseEntity.status(500).body(Map.of(
                "success", false,
                "error", err.getMessage()
            ));
        }
    }
}