package com.app.main.root.app._service;
import org.springframework.stereotype.Service;
import java.util.concurrent.ConcurrentHashMap;
import java.util.Map;

@Service
public class SessionService {
    public enum SessionType {
        LOGIN("LOGIN"),
        MAIN_DASHBOARD("MAIN_DASHBOARD");

        private final String value;

        SessionType(String v) {
            this.value = v;
        }

        public String getValue() {
            return value;
        }
    }

    private final Map<String, SessionData> sessions = new ConcurrentHashMap<>();

    public static class SessionData {
        private SessionType currentSession;
        private String userId;
        private String username;
        private long lastActivity;

        public SessionData(
            SessionType currentSession,
            String userId,
            String username
        ) {
            this.currentSession = currentSession;
            this.userId = userId;
            this.username = username;
            this.lastActivity = System.currentTimeMillis();
        }

        /*
        * Get Current Session 
        */
        public SessionType getCurrentSession() {
            return currentSession;
        }
        /*
        * Get User Id 
        */
        public String getUserId() {
            return userId;
        }
        /*
        * Get Username 
        */
        public String getUsername() {
            return username;
        }
        /*
        * Get Last Activity 
        */
        public long getLastActivity() {
            return lastActivity;
        }

        public void updateSession(SessionType sessionType) {
            this.currentSession = sessionType;
            this.lastActivity = System.currentTimeMillis();
        } 

        public void updateUser(String userId, String username) {
            this.userId = userId;
            this.username = username;
            this.lastActivity = System.currentTimeMillis();
        }
    }

    public void updateUserSession(
        String userId,
        String username,
        SessionType sessionType
    ) {
        SessionData sessionData = sessions.computeIfAbsent(
            userId,
            k -> new SessionData(sessionType, userId, username)
        );
        sessionData.updateSession(sessionType);
        sessionData.updateUser(userId, username);
    }

    public void updateSessionType(String userId, SessionType sessionType) {
        SessionData sessionData = sessions.get(userId);
        if(sessionData != null) sessionData.updateSession(sessionType);
    }

    public SessionData getSession(String userId) {
        return sessions.get(userId);
    }

    public Map<SessionType, Long> getSessionStats() {
        Map<SessionType, Long> stats = new ConcurrentHashMap<>();
        for(SessionType type : SessionType.values()) {
            stats.put(type, 0L);
        }

        sessions.values().forEach(s -> {
            stats.merge(s.getCurrentSession(), 1L, Long::sum);
        });

        return stats;
    }
}
