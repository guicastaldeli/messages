package com.app.main.root.app.__controllers;
import com.app.main.root.app._service.ServiceManager;
import com.app.main.root.app._cache.CacheService;
import org.springframework.web.bind.annotation.*;
import org.springframework.context.annotation.Lazy;
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

    /**
     * Get Chat Data
     */
    @GetMapping("/{chatId}/data")
    public ResponseEntity<?> getChatData(
        @PathVariable String chatId,
        @RequestParam String userId,
        @RequestParam(defaultValue = "0") int page,
        @RequestParam(defaultValue = "20") int pageSize
    ) {
        try {
            Map<String, Object> data = serviceManager.getChatService()
                .getChatData(
                    userId,
                    chatId,
                    page,
                    pageSize
                );

            return ResponseEntity.ok(Map.of(
                "success", true,
                "chatId", chatId,
                "data", data
            ));
        } catch(Exception err) {
            return ResponseEntity.status(500).body(Map.of(
                "success", false,
                "error", err.getMessage()
            ));
        }
    }

    /**
     * Clear Chat Cache
     */
    @DeleteMapping("/{chatId}/cache")
    public ResponseEntity<?> clearChatCache(
        @PathVariable String chatId,
        @RequestParam String userId
    ) {
        try {
            cacheService.invalidateChatCache(userId, chatId);
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
