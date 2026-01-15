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
        if(sessionId != null) {
            if(serviceManager.getSessionService().validateSession(sessionId)) {
                SessionService.SessionData sessionData = serviceManager.getSessionService().getSession(sessionId);
                if(sessionData != null) {
                    String userId = sessionData.getUserId();
                    return userId;
                }
            } else {
                System.out.println("DEBUG - Session is invalid or expired");
            }
        }
        
        HttpSession httpSession = request.getSession(false);
        if(httpSession != null) {
            String userId = (String) httpSession.getAttribute("userId");
            if(userId != null) {
                return userId;
            }
        }
        
        String userIdFromCookies = extractUserIdFromCookies(request);
        if(userIdFromCookies != null) {
            return userIdFromCookies;
        }
        
        return null;
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
            if(authenticatedUserId == null) {
                return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("error", "Not authenticated"));
            }
            if(!authenticatedUserId.equals(userId)) {
                return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(Map.of("error", "User ID mismatch"));
            }
            
            boolean hasAccess = serviceManager.getChatService().userHasAccessToChat(authenticatedUserId, chatId);
            if(!hasAccess) {
                return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(Map.of("error", "Access denied to this chat"));
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
        } catch (Exception err) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(Map.of(
                    "chatId", chatId,
                    "error", "Failed to load chat data for " + chatId + ": " + err.getMessage(),
                    "success", false,
                    "errorType", err.getClass().getSimpleName()
                ));
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