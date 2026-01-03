package com.app.main.root.app._service;
import org.springframework.context.annotation.Lazy;
import org.springframework.scheduling.annotation.Scheduled;
import com.app.main.root.EnvConfig;
import org.springframework.stereotype.Service;
import jakarta.annotation.PostConstruct;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import java.net.URI;
import java.net.URISyntaxException;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.concurrent.ConcurrentHashMap;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

@Service
public class SessionService {
    private @Autowired @Lazy CookieService cookieService;

    public enum SessionType {
        LOGIN("LOGIN"),
        MAIN_DASHBOARD("MAIN_DASHBOARD"),
        DELETED("DELETED");

        private final String value;

        SessionType(String v) {
            this.value = v;
        }

        public String getValue() {
            return value;
        }

        public static SessionType fromString(String val) {
            for(SessionType type : values()) {
                if(type.getValue().equals(val)) {
                    return type;
                }
            }
            return LOGIN;
        }
    }

    private final Map<String, SessionData> userSessions = new ConcurrentHashMap<>();
    private final Map<String, String> tokenToUserIdMap = new ConcurrentHashMap<>();
    private final Map<String, Set<String>> userIdToTokensMap = new ConcurrentHashMap<>();
    private String webUrl = EnvConfig.get("WEB_URL");
    private String cookieDomain = EnvConfig.get("WEB_URL");

    @Value("${session.timeout.minutes:30}")
    private int sessionTimeoutMinutes;

    @Value("${session.rememberuser.timeout.days:7}")
    private int rememberUserTimeoutDays;
    
    @Value("${cookie.secure:false}")
    private boolean cookieSecure;

    public static class SessionData {
        private String sessionId;
        private SessionType currentSession;
        private String userId;
        private String username;
        private String email;
        private String userAgent;
        private String ipAddress;
        private LocalDateTime createdAt;
        private LocalDateTime lastActivity;
        private LocalDateTime expiresAt;
        private boolean rememberUser;
        private Map<String, Object> sessionAttrs;

        public SessionData(
            String sessionId,
            SessionType currentSession,
            String userId,
            String username,
            String email,
            String userAgent,
            String ipAddress,
            boolean rememberUser
        ) {
            this.sessionId = sessionId;
            this.currentSession = currentSession;
            this.userId = userId;
            this.username = username;
            this.email = email;
            this.userAgent = userAgent;
            this.ipAddress = ipAddress;
            this.createdAt = LocalDateTime.now();
            this.rememberUser = rememberUser;
            this.updateActivity();
            this.sessionAttrs = new ConcurrentHashMap<>();
        }

        /**
         * Get Session Id 
         */
        public String getSessionId() {
            return sessionId;
        }

        /**
         * Get Current Session 
         */
        public SessionType getCurrentSession() {
            return currentSession;
        }

        /**
         * Get User Id 
         */
        public String getUserId() {
            return userId;
        }

        /**
         * Get Username 
         */
        public String getUsername() {
            return username;
        }

        /**
         * Get Email 
         */
        public String getEmail() {
            return email;
        }

        /**
         * Get User Agent
         */
        public String getUserAgent() {
            return userAgent;
        }

        /**
         * Get Ip Address
         */
        public String getIpAddress() {
            return ipAddress;
        }

        /**
         * Get Last Activity
         */
        public LocalDateTime getLastActivity() {
            return lastActivity;
        }

        /**
         * Get Expires At
         */
        public LocalDateTime getCreatedAt() {
            return createdAt;
        }

        /**
         * Get Expires At
         */
        public LocalDateTime getExpiresAt() {
            return expiresAt;
        }

        /**
         * Remember User
         */
        public boolean isRememberUser() {
            return rememberUser;
        }

        /**
         * Get Session Attributes
         */
        public Map<String, Object> getSessionAttrs() {
            return sessionAttrs;
        }

        public ActivityUpdate updateActivity() {
            this.lastActivity = LocalDateTime.now();
            this.expiresAt = rememberUser ?
                this.lastActivity.plusDays(7) :
                this.lastActivity.plusMinutes(30);

            return new ActivityUpdate(this.lastActivity, this.expiresAt);
        }

        public void updateSessionType(SessionType type) {
            this.currentSession = type;
            updateActivity();
        }

        public void updateUserInfo(
            String userId, 
            String username,
            String email
        ) {
            this.userId = userId;
            this.username = username;
            this.email = email;
            updateActivity();
        }

        /**
         * Session Attribute
         */
        public void setAttr(String key, Object val) {
            sessionAttrs.put(key, val);
            updateActivity();
        }

        public Object getAttr(String key) {
            return sessionAttrs.get(key);
        }

        public void removeAttr(String key) {
            sessionAttrs.remove(key);
        }

        /**
         * Session Expired
         */
        public boolean isExpired() {
            return LocalDateTime.now().isAfter(expiresAt);
        }

        /**
         * Extend Session
         */
        public void extendSession(boolean rememberUser) {
            this.rememberUser = rememberUser;
            this.updateActivity();
        }
    }

    @PostConstruct
    public void init() {
        cleanupExpiredSessions();
    }

    /**
     * Create Session
     */
    public String createSession(
        SessionType type,
        String userId,
        String username,
        String email,
        String userAgent,
        String ipAddress,
        boolean rememberUser,
        HttpServletResponse response
    ) {
        String sessionId = generateSessionId();
        SessionData sessionData = new SessionData(
            sessionId,
            type, 
            userId, 
            username, 
            email, 
            userAgent, 
            ipAddress, 
            rememberUser
        );

        userSessions.put(sessionId, sessionData);
        tokenToUserIdMap.put(sessionId, userId);
        userIdToTokensMap.computeIfAbsent(
            userId,
            k -> new HashSet<>()
        ).add(sessionId);
        
        setSessionCookie(sessionId, rememberUser, response);
        return sessionId;
    }

    /**
     * Get Session
     */
    public SessionData getSession(String id) {
        SessionData session = userSessions.get(id);
        if(session != null && !session.isExpired()) {
            session.updateActivity();
            return session;
        }
        return null;
    }

    public List<SessionData> getSessionsByUserId(String userId) {
        List<SessionData> sessions = new ArrayList<>();
        Set<String> sessionIds = userIdToTokensMap.get(userId);
        if(sessionIds != null) {
            for(String sId : sessionIds) {
                SessionData session = getSession(sId);
                if(session != null) sessions.add(session);
            }
        }
        return sessions;
    }

    public SessionData getSessionBySessionId(String sessionId) {
        return userSessions.get(sessionId);
    }

    public int getActiveSessionCount(String userId) {
        int count = 0;
        Set<String> sessionIds = userIdToTokensMap.get(userId);
        if(sessionIds != null) {
            for(String sId : sessionIds) {
                SessionData session = userSessions.get(sId);
                if(session != null && !session.isExpired()) {
                    count++;
                }
            }
        }
        return count;
    }

    /**
     * Update
     */
    public void updateSessionType(String sessionId, SessionType type) {
        SessionData session = getSession(sessionId);
        if(session != null) session.updateSessionType(type);
    } 

    public void updateUserSession(String sessionId, String userId, SessionType type) {
        SessionData session = getSession(sessionId);

        if(session != null) {
            String username = session.getUsername();
            String email = session.getEmail();
            
            session.updateUserInfo(userId, username, email);
            session.updateSessionType(type);

            String oldUserId = tokenToUserIdMap.get(sessionId);
            if(oldUserId != null && !oldUserId.equals(userId)) {
                Set<String> oldSessions = userIdToTokensMap.get(oldUserId);
                if(oldSessions != null) oldSessions.remove(sessionId);
            }

            tokenToUserIdMap.put(sessionId, userId);
            userIdToTokensMap.computeIfAbsent(userId, k -> new HashSet<>()).add(sessionId);
        } else {
            throw new IllegalArgumentException("Session cannot be created!" + sessionId);
        }
    }

    /**
     * Validate
     */
    public boolean validateSession(String sessionId) {
        SessionData session = getSession(sessionId);
        return session != null && !session.isExpired();
    }

    /**
     * Destroy
     */
    public void destroySession(String sessionId, HttpServletResponse response) {
        SessionData session = userSessions.remove(sessionId);
        if(session != null) {
            String userId = tokenToUserIdMap.remove(sessionId);
            if(userId != null) {
                Set<String> sessions = userIdToTokensMap.get(userId);
                if(sessions != null) {
                    sessions.remove(sessionId);
                    if(sessions.isEmpty()) {
                        userIdToTokensMap.remove(userId);
                    }
                }
            }
        }
        clearSessionCookie(response);
    }

    public void destroyAllSessionsForUser(String userId, HttpServletResponse response) {
        Set<String> sessionIds = userIdToTokensMap.remove(userId);
        if(sessionIds != null) {
            for(String sId : sessionIds) {
                userSessions.remove(sId);
                tokenToUserIdMap.remove(sId);
            }
        }
        clearSessionCookie(response);
    }

    /**
     * Set Session Attribute
     */
    public void setSessionAttr(String sessionId, String key, Object val) {
        SessionData session = getSession(sessionId);
        if(session != null) session.setAttr(key, val);
    }

    /**
     * Get Session Attribute
     */
    public Object getSessionAttr(String sessionId, String key) {
        SessionData session = getSession(sessionId);
        if(session != null) session.getAttr(key);
        return null;
    }

    /**
     * Remove Session Attribute
     */
    public void removeSessionAttr(String sessionId, String key) {
        SessionData session = getSession(sessionId);
        if(session != null) session.removeAttr(key);
    }

    public Map<SessionType, Long> getSessionStats() {
        Map<SessionType, Long> stats = new ConcurrentHashMap<>();
        for(SessionType type : SessionType.values()) {
            stats.put(type, 0L);
        }

        userSessions.values().forEach(s -> {
            if(!s.isExpired()) {
                stats.merge(s.getCurrentSession(), 1L, Long::sum);
            }
        });

        return stats;
    }
    
    /**
     * Get All Active Sessions
     */
    public List<SessionData> getAllActiveSessions() {
        List<SessionData> activeSessions = new ArrayList<>();
        for(SessionData session : userSessions.values()) {
            if(!session.isExpired()) {
                activeSessions.add(session);
            }
        }
        return activeSessions;
    }
    
    /**
     * Get Session Count
     */
    public int getActiveSessionCount() {
        int count = 0;
        for(SessionData session : userSessions.values()) {
            if(!session.isExpired()) {
                count++;
            }
        }
        return count;
    }

    /**
     * Cleanup Expired Sessions
     */
    @Scheduled(fixedRate = 300000)
    public void cleanupExpiredSessions() {
        int removed = 0;
        for(Map.Entry<String, SessionData> entry : userSessions.entrySet()) {
            SessionData session = entry.getValue();
            if(session.isExpired()) {
                userSessions.remove(entry.getKey());
                String userId = tokenToUserIdMap.remove(entry.getKey());
                if(userId != null) {
                    Set<String> sessions = userIdToTokensMap.get(userId);
                    if(sessions != null) {
                        sessions.remove(entry.getKey());
                        if(sessions.isEmpty()) userIdToTokensMap.remove(userId);
                    }
                }
            }
            removed++;
        }
        if(removed > 0) {
            System.out.println("Cleaned up " + removed + " expired sessions");
        }
    }

    private String generateSessionId() {
        return "sess_" + UUID.randomUUID().toString().replace("-", "");
    }

    private String extractDomainFromUrl(String url) {
        try {
            URI uri = new URI(url);
            String host = uri.getHost();

            if (host.equals("localhost") || host.equals("127.0.0.1")) {
                return "localhost";
            }
            return host;
        } catch(URISyntaxException err) {
            System.out.println(err);
            return "localhost";
        }
    }

    /**
     * Set Session Cookie
     */
    private void setSessionCookie(
        String sessionId, 
        boolean rememberUser, 
        HttpServletResponse response
    ) {
        if(response != null && cookieService != null) {
            String domain = extractDomainFromUrl(webUrl);

            /* Session Cookie */
            String sessionCookieName = CookieService.SESSION_ID_KEY != null ? 
                CookieService.SESSION_ID_KEY : "SESSION_ID";
            
            Cookie cookie = new Cookie(sessionCookieName, sessionId);
            cookie.setHttpOnly(true);
            cookie.setSecure(cookieSecure);
            cookie.setPath("/");
            cookie.setDomain(domain);
            if(rememberUser) {
                cookie.setMaxAge(rememberUserTimeoutDays * 24 * 60 * 60);
            } else {
                cookie.setMaxAge(sessionTimeoutMinutes * 60);
            }
            if(!cookieDomain.equals(webUrl)) {
                cookie.setDomain(cookieDomain);
            }
            String cookieHeader = String.format(
                "%s=%s; Max-Age=%d; Path=%s; Domain=%s; HttpOnly; SameSite=Lax",
                sessionCookieName, 
                sessionId,
                cookie.getMaxAge(), 
                "/", 
                domain
            );
            response.addHeader("Set-Cookie", cookieHeader);
            response.addCookie(cookie);

            /* Client Cookies */
            Cookie statusCookie = new Cookie(CookieService.SESSION_STATUS_KEY, "active");
            statusCookie.setHttpOnly(false);
            statusCookie.setSecure(cookieSecure);
            statusCookie.setPath("/");
            statusCookie.setMaxAge(
                rememberUser ? 
                rememberUserTimeoutDays * 24 * 60 * 60 : 
                sessionTimeoutMinutes * 60
            );
            if(!cookieDomain.equals(webUrl)) statusCookie.setDomain(cookieDomain);
            response.addCookie(statusCookie);

            /* Remember Cookies */
            Cookie rememberCookie = new Cookie(CookieService.REMEMBER_USER, Boolean.toString(rememberUser));
            rememberCookie.setHttpOnly(false);
            rememberCookie.setSecure(cookieSecure);
            rememberCookie.setPath("/");
            rememberCookie.setMaxAge(
                rememberUser ? 
                rememberUserTimeoutDays * 24 * 60 * 60 : 
                sessionTimeoutMinutes * 60
            );
            if(!cookieDomain.equals(webUrl)) rememberCookie.setDomain(cookieDomain);
            response.addCookie(rememberCookie);
        } else {
            System.err.println("ERR response or cookieService is null!");
        }
    }

    private void clearSessionCookie(HttpServletResponse response) {
        if(response != null) {
            /* Cookie */
            Cookie cookie = new Cookie(CookieService.SESSION_ID_KEY, null);
            cookie.setHttpOnly(true);
            cookie.setSecure(cookieSecure);
            cookie.setPath("/");
            cookie.setMaxAge(0);
            if(!cookieDomain.equals(webUrl)) cookie.setDomain(cookieDomain);

            response.addCookie(cookie);

            /* Client Cookie */
            Cookie clientCookie = new Cookie(CookieService.SESSION_STATUS_KEY, null);
            clientCookie.setHttpOnly(true);
            clientCookie.setSecure(cookieSecure);
            clientCookie.setPath("/");
            clientCookie.setMaxAge(0);
            if(!cookieDomain.equals(webUrl)) clientCookie.setDomain(cookieDomain);

            response.addCookie(clientCookie);
        }
    }

    /**
     * Extract Session Id
     */
    public String extractSessionId(HttpServletRequest request) {
        Cookie[] cookies = request.getCookies();
        if(cookies != null) {
            for(Cookie c : cookies) {
                if(CookieService.SESSION_ID_KEY.equals(c.getName())) {
                    return c.getValue();
                }
            }
        }

        String authHeader = request.getHeader("Authorization");
        if(authHeader != null && authHeader.startsWith("Bearer ")) {
            return authHeader.substring(7);
        }

        String sessionParam = request.getParameter("sessionId");
        if(sessionParam != null && !sessionParam.isEmpty()) {
            return sessionParam;
        }

        return null;
    }

    /**
     * Refresh Session
     */
    public boolean refreshSession(
        String sessionId,
        boolean rememberUser,
        HttpServletResponse response
    ) {
        SessionData session = getSession(sessionId);
        if(session != null) {
            session.extendSession(rememberUser);
            setSessionCookie(sessionId, rememberUser, response);
            return true;
        }
        return false;
    }

    public boolean hasValidSession(String sessionId) {
        return validateSession(sessionId);
    }

    public long getSessionAgeMinutes(String sessionId) {
        SessionData session = getSession(sessionId);
        if(session != null) {
            return ChronoUnit.MINUTES.between(
                session.getCreatedAt(), 
                LocalDateTime.now()
            );
        }
        return -1;
    }

    public long getTimeUntilExpiryMinutes(String sessionId) {
        SessionData session = getSession(sessionId);
        if(session != null) {
            return ChronoUnit.MINUTES.between(
                LocalDateTime.now(), 
                session.getExpiresAt()
            );
        }
        return -1;
    }

    public SessionData getSessionData(String sessionId) {
        SessionData session = getSession(sessionId);
        return session;
    }
}
