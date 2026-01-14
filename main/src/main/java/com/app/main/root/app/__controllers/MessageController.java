package com.app.main.root.app.__controllers;
import com.app.main.root.app._service.ServiceManager;
import com.app.main.root.app._service.SessionService;
import com.app.main.root.app._types.Message;
import com.app.main.root.app._types.RecentChat;
import com.app.main.root.app.main.chat.messages.MessageLog;
import com.app.main.root.app.main.chat.messages.MessageTracker;
import org.springframework.context.annotation.Lazy;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpSession;
import java.sql.SQLException;
import java.util.*;

@RestController
@RequestMapping("/api/message")
public class MessageController {
    private final MessageTracker messageTracker;
    private final ServiceManager serviceManager;

    public MessageController(
        MessageTracker messageTracker,
        @Lazy ServiceManager serviceManager
    ) {
        this.messageTracker = messageTracker;
        this.serviceManager = serviceManager;
    }

    private String getAuthenticatedUserId(HttpServletRequest request) {
        String sessionId = serviceManager.getSessionService().extractSessionId(request);
        if(sessionId != null) {
            //System.out.println("DEBUG - Found sessionId: " + sessionId);
            
            if(serviceManager.getSessionService().validateSession(sessionId)) {
                SessionService.SessionData sessionData = serviceManager.getSessionService().getSession(sessionId);
                if(sessionData != null) {
                    String userId = sessionData.getUserId();
                    //System.out.println("DEBUG - Found userId from session data: " + userId);
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
                //System.out.println("DEBUG - Found userId from HTTP session: " + userId);
                return userId;
            }
        }
        
        String userIdFromCookies = extractUserIdFromCookies(request);
        if(userIdFromCookies != null) {
            //System.out.println("DEBUG - Found userId from cookies: " + userIdFromCookies);
            return userIdFromCookies;
        }
        
        //System.out.println("DEBUG - No userId found in session, HTTP session, or cookies");
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
                                //System.out.println("DEBUG - Found direct userId in cookie: " + value);
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
     * Save
     */
    @PostMapping("/messages")
    public MessageLog saveMessage(@RequestBody Map<String, Object> data) {
        try {
            Date time = new Date();
            String messageId = (String) data.get("messageId");
            String content = (String) data.get("content");
            String senderId = (String) data.get("senderId");
            String username = (String) data.get("username");
            String chatId = (String) data.get("chatId");
            MessageLog.MessageType messageType = MessageLog.MessageType.valueOf(((String) data.get("messageType")).toUpperCase());
            MessageLog.MessageDirection direction = MessageLog.MessageDirection.valueOf(((String) data.get("direction")).toUpperCase());
            serviceManager.getMessageService().saveMessage(chatId, senderId, content, messageType.name(), username);
            MessageLog log = new MessageLog(messageId, content, senderId, username, chatId, messageType, direction, time);
            messageTracker.track(
                messageId, 
                content, 
                senderId, 
                username, 
                chatId, 
                messageType, 
                direction
            );
            return log;
        } catch(SQLException err) {
            throw new RuntimeException("Error tracker controller", err);
        }
    }

    /**
     * All Messages
     */
    @GetMapping("/get-messages")
    public List<Message> getAllMessages() throws SQLException {
        return serviceManager.getMessageService().getAllMessages();
    }

    /**
     * Chat Id
     */
    @GetMapping("/messages/chatId/{chatId}")
    public Map<String, Object> getMessagesByChatId(
        @PathVariable String chatId,
        @RequestParam(defaultValue = "0") int page,
        @RequestParam(defaultValue = "20") int pageSize
    ) {
        try {
            List<Message> messages = serviceManager.getMessageService().getMessagesByChatId(chatId, page, pageSize);
            int totalCount = serviceManager.getMessageService().getMessageCountByChatId(chatId);
            boolean hasMore = (page + 1) * pageSize < totalCount;
            
            Map<String, Object> response = new HashMap<>();
            response.put("messages", messages);
            response.put("chatId", chatId);
            response.put("page", page);
            response.put("pageSize", pageSize);
            response.put("total", totalCount);
            response.put("hasMore", hasMore);
            
            return response;
        } catch(SQLException err) {
            throw new RuntimeException("Error fetching messages for chat: " + chatId, err);
        }
    }

    @GetMapping("/messages/chatId/{chatId}/count")
    public Map<String, Object> getMessageCountByChatId(@PathVariable String chatId) {
        try {
            int count = serviceManager.getMessageService().getMessageCountByChatId(chatId);
            Map<String, Object> res = new HashMap<>();
            res.put("chatId", chatId);
            res.put("count", count);
            res.put("success", true);
            return res;
        } catch(SQLException err) {
            Map<String, Object> errorRes = new HashMap<>();
            errorRes.put("success", false);
            errorRes.put("error", err.getMessage());
            errorRes.put("chatId", chatId);
            errorRes.put("count", 0);
            return errorRes;
        }
    }

    /**
     * Recent Messages
     */
    @GetMapping("/messages/recent/{userId}")
    public ResponseEntity<?> getRecentMessages(
        @PathVariable String userId, 
        @RequestParam(defaultValue = "0") int page,
        @RequestParam(defaultValue = "20") int pageSize,
        HttpServletRequest request
    ) {
        try {
            String authenticatedUserId = getAuthenticatedUserId(request);
            if(authenticatedUserId == null || !authenticatedUserId.equals(userId)) {
                return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(Map.of(
                        "error", "Unauthorized access",
                        "message", "You can only access your own messages"
                    ));
            }
            
            int offset = page * pageSize;
            List<RecentChat> chats = serviceManager.getMessageService().getRecentChats(authenticatedUserId, pageSize, offset);
            int totalCount = serviceManager.getMessageService().getRecentChatsCount(authenticatedUserId);
            boolean hasMore = (page + 1) * pageSize < totalCount;
            
            Map<String, Object> response = new HashMap<>();
            response.put("chats", chats);
            response.put("userId", authenticatedUserId);
            response.put("page", page);
            response.put("pageSize", pageSize);
            response.put("total", totalCount);
            response.put("hasMore", hasMore);
            
            return ResponseEntity.ok(response);
        } catch(SQLException err) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(Map.of(
                    "error", "Error fetching recent chats",
                    "message", err.getMessage()
                ));
        }
    }

    @GetMapping("/messages/recent/{userId}/count")
    public ResponseEntity<?> getRecentChatsCount(@PathVariable String userId, HttpServletRequest request) {
        try {
            String authenticatedUserId = getAuthenticatedUserId(request);
            
            if(authenticatedUserId == null || !authenticatedUserId.equals(userId)) {
                return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(Map.of(
                        "error", "Unauthorized access",
                        "message", "You can only access your own message count"
                    ));
            }
            
            int count = serviceManager.getMessageService().getRecentChatsCount(authenticatedUserId);
            Map<String, Object> res = new HashMap<>();
            res.put("userId", authenticatedUserId);
            res.put("count", count);
            res.put("success", true);
            return ResponseEntity.ok(res);
        } catch(SQLException err) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(Map.of(
                    "success", false,
                    "error", err.getMessage(),
                    "userId", userId,
                    "count", 0
                ));
        }
    }


    /**
     * Get By User Id
     */
    @GetMapping("/messages/userId/{userId}")
    public ResponseEntity<?> getMessagesByUserId(@PathVariable String userId, HttpServletRequest request) {
        try {
            String authenticatedUserId = getAuthenticatedUserId(request);
            
            if(authenticatedUserId == null || !authenticatedUserId.equals(userId)) {
                return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(Map.of(
                        "error", "Unauthorized access",
                        "message", "You can only access your own messages"
                    ));
            }
            
            if(userId == null || userId.equals("null") || userId.trim().isEmpty()) {
                return ResponseEntity.ok(new ArrayList<>());
            }
            
            List<Message> messages = serviceManager.getMessageService().getMessagesByUserId(authenticatedUserId);
            return ResponseEntity.ok(messages);
        } catch(SQLException err) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(List.of());
        }
    }

    /**
     * Stats
     */
    @GetMapping("/stats")
    public Map<String, Long> getMessageStats() throws SQLException {
        return messageTracker.getMessageStats();
    }

    /**
     * Count 
     */
    @GetMapping("/count")
    public int getMessageCount() throws SQLException {
        return messageTracker.getMessageCount();
    }

    /**
     * Clear 
     */
    @DeleteMapping("/clear")
    public void clearMessages() throws SQLException {
        messageTracker.clearMessages();
    }
}