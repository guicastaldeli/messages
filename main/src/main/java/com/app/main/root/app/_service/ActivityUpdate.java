package com.app.main.root.app._service;

import java.time.LocalDateTime;

public class ActivityUpdate {
    private final LocalDateTime lastActivity;
    private final LocalDateTime expiresAt;

    public ActivityUpdate(
        LocalDateTime lastActivity,
        LocalDateTime expiresAt
    ) {
        this.lastActivity = lastActivity;
        this.expiresAt = expiresAt;
    }

    public LocalDateTime getLastActivity() {
        return lastActivity;
    }
    
    public LocalDateTime getExpiresAt() {
        return expiresAt;
    }
}
