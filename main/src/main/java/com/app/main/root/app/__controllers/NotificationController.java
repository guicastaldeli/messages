package com.app.main.root.app.__controllers;
import com.app.main.root.app._service.ServiceManager;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import java.sql.SQLException;
import java.util.*;

@RestController
@RequestMapping("/api/notifications")
public class NotificationController {
    private final ServiceManager serviceManager;

    public NotificationController(ServiceManager serviceManager) {
        this.serviceManager = serviceManager;
    }

    /**
     * Save Notification
     */
    @PostMapping
    public ResponseEntity<?> saveNotification(@RequestBody Map<String, Object> data) {
        try {
            serviceManager.getNotificationService().saveNotification(data);
            return ResponseEntity.ok(Map.of(
                "success",
                true,
                "message",
                "Notification Saved"
            ));
        } catch(SQLException err) {
            return ResponseEntity.status(500).body(Map.of(
                "success", false, 
                "error", err.getMessage()
            ));
        }
    }

    /**
     * Get User Notification
     */
    @GetMapping("/user/{userId}")
    public ResponseEntity<?> getUserNotifications(@PathVariable String userId) {
        try {
            List<Map<String, Object>> data = serviceManager.getNotificationService().getUserNotification(userId);
            return ResponseEntity.ok(Map.of(
                "success", true,
                "notifications", data
            ));
        } catch (SQLException err) {
            return ResponseEntity.status(500).body(Map.of(
                "success", false,
                "error", err.getMessage()
            ));
        }
    }

    /**
     * Mark as Read
     */
    @PutMapping("/{notificationId}/read")
    public ResponseEntity<?> markAsRead(@PathVariable String notificationId) {
        try {
            serviceManager.getNotificationService().markAsRead(notificationId);
            return ResponseEntity.ok(Map.of("success", true));
        } catch (SQLException err) {
            return ResponseEntity.status(500).body(Map.of(
                "success", false,
                "error", err.getMessage()
            ));
        }
    }

    @PutMapping("/user/{userId}/read-all")
    public ResponseEntity<?> markAllAsRead(@PathVariable String userId) {
        try {
            serviceManager.getNotificationService().markAllAsRead(userId);
            return ResponseEntity.ok(Map.of("success", true));
        } catch (SQLException err) {
            return ResponseEntity.status(500).body(Map.of(
                "success", false,
                "error", err.getMessage()
            ));
        }
    }

    /**
     * Delete Notification
     */
    @DeleteMapping("/{notificationId}")
    public ResponseEntity<?> deleteNotification(@PathVariable String notificationId) {
        try {
            serviceManager.getNotificationService().deleteNotification(notificationId);
            return ResponseEntity.ok(Map.of("success", true));
        } catch (SQLException err) {
            return ResponseEntity.status(500).body(Map.of(
                "success", false,
                "error", err.getMessage()
            ));
        }
    }

    /**
     * Get Unread Count
     */
    @GetMapping("/user/{userId}/unread-count")
    public ResponseEntity<?> getUnreadCount(@PathVariable String userId) {
        try {
            int count = serviceManager.getNotificationService().getUnreadCount(userId);
            return ResponseEntity.ok(Map.of(
                "success", true,
                "count", count
            ));
        } catch (SQLException err) {
            return ResponseEntity.status(500).body(Map.of(
                "success", false,
                "error", err.getMessage()
            ));
        }
    }
}
