package com.app.main.root.app.__controllers;
import com.app.main.root.app._auth.AuthManager;
import com.app.main.root.app._auth.RegisterRequest;
import com.app.main.root.app._auth.LoginRequest;
import com.app.main.root.app.EventTracker;
import com.app.main.root.app._service.ServiceManager;
import com.app.main.root.app._service.SessionService;
import com.app.main.root.app._types._User;
import com.app.main.root.app._server.ConnectionTracker;
import org.springframework.context.annotation.Lazy;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/auth")
public class AuthController {
    private final EventTracker eventTracker;
    private final ServiceManager serviceManager;
    private final AuthManager authManager;
    private final ConnectionTracker connectionTracker;

    private RegisterRequest registerRequest;
    private LoginRequest loginRequest;

    public AuthController(
        @Lazy AuthManager authManager,
        @Lazy EventTracker eventTracker, 
        @Lazy ServiceManager serviceManager,
        @Lazy ConnectionTracker connectionTracker
    ) {
        this.authManager = authManager;
        this.eventTracker = eventTracker;
        this.serviceManager = serviceManager;
        this.connectionTracker = connectionTracker;
    }

    /**
     * Register
     */
    @PostMapping("/register")
    public ResponseEntity<?> registerUser(
        @RequestBody RegisterRequest request, 
        HttpServletRequest httpRequest,
        HttpServletResponse response
    ) {
        try {
            System.out.println("Registration attempt for: " + request.getEmail());

            Map<String, Object> result = serviceManager.getUserService().registerUser(
                request.getUsername(),
                request.getEmail(),
                request.getPassword(),
                request.getSessionId(),
                connectionTracker.getClientIpAddress(httpRequest)
            );

            String userId = (String) result.get("userId");
            String username = (String) result.get("username");
            String email = (String) result.get("email");
            boolean rememberUser = request.isRememberUser();

            String sessionId = serviceManager.getSessionService()
                .createSession(
                    SessionService.SessionType.MAIN_DASHBOARD,
                    userId,
                    username,
                    email,
                    httpRequest.getHeader("User-Agent"),
                    connectionTracker.getClientIpAddress(httpRequest),
                    rememberUser,
                    response
                );
            serviceManager.getCookieService().setAuthCookies(
                response, 
                sessionId, 
                userId, 
                username,
                email,
                rememberUser
            );
            String token = serviceManager.getTokenService()
                .generateAccessToken(
                    sessionId, 
                    userId, 
                    username, 
                    email
                );
            result.put("token", token);
            result.put("sessionId", sessionId);

            System.out.println("Registered!:" + request.getEmail());
            return ResponseEntity.ok(result);
        } catch(Exception err) {
            System.err.println("Registration failed" + err.getMessage());
            err.printStackTrace();
            return ResponseEntity.badRequest()
                .body(
                    Map.of(
                        "error",
                        "REGISTRATION_FAILED",
                        "message",
                        err.getMessage()
                    )
                );
        }
    }

    /**
     * Login
     */
    @PostMapping("/login")
    public ResponseEntity<?> loginUser(
        @RequestBody LoginRequest request, 
        HttpServletRequest httpRequest,
        HttpServletResponse response
    ) {
        try {
            System.out.println("Login attempt for: " + request.getEmail());

            Map<String, Object> result = serviceManager.getUserService().loginUser(
                request.getEmail(),
                request.getPassword(),
                request.getSessionId(),
                connectionTracker.getClientIpAddress(httpRequest)
            );

            String userId = (String) result.get("userId");
            String username = (String) result.get("username");
            String email = (String) result.get("email");
            boolean rememberUser = request.isRememberUser();

            String sessionId;
            List<SessionService.SessionData> userSessions = 
                serviceManager.getSessionService().getSessionsByUserId(userId);
            
            SessionService.SessionData existingSession = null;
            for(SessionService.SessionData session : userSessions) {
                if(!session.isExpired()) {
                    existingSession = session;
                    break;
                }
            }
            
            if(existingSession != null) {
                sessionId = existingSession.getSessionId();
                System.out.println("Using existing session: " + sessionId);
                serviceManager.getSessionService().refreshSession(
                    sessionId, 
                    rememberUser, 
                    response
                );
            } else {
                sessionId = serviceManager.getSessionService()
                    .createSession(
                        SessionService.SessionType.MAIN_DASHBOARD,
                        userId,
                        username,
                        email,
                        httpRequest.getHeader("User-Agent"),
                        connectionTracker.getClientIpAddress(httpRequest),
                        rememberUser,
                        response
                    );
                System.out.println("Created new session: " + sessionId);
            }

            serviceManager.getCookieService().setAuthCookies(
                response, 
                sessionId, 
                userId, 
                username,
                email,
                rememberUser
            );
            String token = serviceManager.getTokenService()
                .generateAccessToken(
                    sessionId, 
                    userId, 
                    username, 
                    email
                );
            result.put("token", token);
            result.put("sessionId", sessionId);

            System.out.println("Logged!: " + request.getEmail());
            return ResponseEntity.ok(result);
        } catch(Exception err) {
            return ResponseEntity.badRequest()
                .body(
                    Map.of(
                        "error",
                        "LOGIN_FAILED",
                        "message",
                        err.getMessage()
                    )
                );
        }
    }

    /**
     * Logout
     */
    @PostMapping("/logout")
    public ResponseEntity<?> logoutUser(
        HttpServletRequest request,
        HttpServletResponse response
    ) {
        try {
            String sessionId = serviceManager.getSessionService().extractSessionId(request);
            if(sessionId != null) {
                connectionTracker.trackDisconnection(sessionId);
                serviceManager.getSessionService().destroySession(sessionId, response);
                serviceManager.getCookieService().clearAuthCookies(response);

                String token = extractTokenFromRequest(request);
                if(token != null && serviceManager.getTokenService().validateToken(token)) {
                    serviceManager.getTokenService().blacklistToken(token);
                }
            }

            return ResponseEntity.ok(
                Map.of(
                    "success", true,
                    "message", "Logged out success"
                )
            );
        } catch(Exception err) {
            return ResponseEntity.ok(
                Map.of(
                    "success", false,
                    "message", "Logged out err"
                )
            );
        }
    }

    /**
     * Validate Session
     */
    @GetMapping("/validate")
    public ResponseEntity<?> validateSession(
        HttpServletRequest request,
        HttpServletResponse response
    ) {
        try {
            String sessionId = serviceManager.getSessionService().extractSessionId(request);
            if(sessionId == null || sessionId.isEmpty()) {
                return ResponseEntity.status(401)
                    .body(
                        Map.of(
                            "valid", false,
                            "message", "No session found"
                        )
                    );
            }

            boolean isValid = serviceManager.getSessionService().validateSession(sessionId);
            if(!isValid) {
                serviceManager.getCookieService().clearAuthCookies(response);
                return ResponseEntity.status(401)
                    .body(
                        Map.of(
                            "valid", false,
                            "message", "Session expired or invalid"
                        )
                    );
            }

            SessionService.SessionData sessionData = serviceManager.getSessionService().getSession(sessionId);
            if(sessionData == null) {
                return ResponseEntity.status(401)
                    .body(
                        Map.of(
                            "valid", false,
                            "message", "Session expired or invalid"
                        )
                    );
            }

            String clientIp = connectionTracker.getClientIpAddress(request);
            String userAgent = request.getHeader("User-Agent");
            connectionTracker.trackConnection(sessionId, clientIp, userAgent);
            connectionTracker.updateUsername(sessionId, sessionData.getUsername());

            serviceManager.getSessionService().refreshSession(
                sessionId, 
                sessionData.isRememberUser(), 
                response
            );

            _User user = serviceManager.getUserService().getUserById(sessionData.getUserId());
            if(user == null) {
                return ResponseEntity.status(401)
                    .body(
                        Map.of(
                            "valid", false,
                            "message", "User not found"
                        )
                    );
            }

            return ResponseEntity.ok(
                Map.of(
                    "valid", true,
                    "user", Map.of(
                        "userId", user.getId(),
                        "username", user.getUsername(),
                        "email", user.getEmail()
                    ),
                    "session", Map.of(
                        "sessionId", sessionId,
                        "currentSession", sessionData.getCurrentSession().getValue(),
                        "rememberUser", sessionData.isRememberUser(),
                        "createdAt", sessionData.getCreatedAt(),
                        "lastActivity", sessionData.getLastActivity(),
                        "expiresAt", sessionData.getExpiresAt()
                    )
                )
            );
        } catch(Exception err) {
            System.err.println("Session validation err" + err.getMessage());
            return ResponseEntity.status(500)
                .body(
                    Map.of(
                        "valid", false,
                        "message", "Internal server error"
                    )
                );
        }
    }

    /**
     * Refresh Session
     */
    @GetMapping("/refresh")
    public ResponseEntity<?> refreshToken(
        HttpServletRequest request,
        HttpServletResponse response
    ) {
        try {
            String sessionId = serviceManager.getSessionService().extractSessionId(request);
            if(sessionId == null || sessionId.isEmpty()) {
                return ResponseEntity.status(401)
                    .body(
                        Map.of(
                            "valid", false,
                            "message", "User not found"
                        )
                    ); 
            }

            SessionService.SessionData sessionData = serviceManager.getSessionService().getSession(sessionId);
            if(sessionData == null || sessionData.isExpired()) {
                serviceManager.getCookieService().clearAuthCookies(response);
                return ResponseEntity.status(401)
                    .body(
                        Map.of(
                            "success", false,
                            "error", "SESSION_EXPIRED",
                            "message", "Session has expired"
                        )
                    );
            }

            String newToken = serviceManager.getTokenService()
                .generateAccessToken(
                    sessionId,
                    sessionData.getUserId(),
                    sessionData.getUsername(),
                    sessionData.getEmail()
                );

            boolean extendSession = sessionData.isRememberUser();
            if(extendSession) {
                serviceManager.getSessionService().refreshSession(
                    sessionId, 
                    true, 
                    response
                );
                serviceManager.getCookieService().setAuthCookies(
                    response, 
                    sessionId, 
                    sessionData.getUserId(), 
                    sessionData.getUsername(), 
                    sessionData.getEmail(),
                    true
                );
            }

            return ResponseEntity.ok(
                Map.of(
                    "success", true,
                    "token", newToken,
                    "sessionId", sessionId,
                    "expiresIn", sessionData.isRememberUser() ? "7d" : "30m"
                )
            );
        } catch(Exception err) {
            System.err.println("Token refresh error " + err.getMessage());
            return ResponseEntity.status(500)
                .body(
                    Map.of(
                        "success", false,
                        "error", "REFRESH_FAILED",
                        "message", "Failed to refresh token"
                    )
                );
        }
    }

    /**
     * Get Session Status
     */
    @GetMapping("/status")
    public ResponseEntity<?> getSessionStatus(HttpServletRequest request) {
        try {
            String sessionId = serviceManager.getSessionService().extractSessionId(request);
            if(sessionId == null) {
                return ResponseEntity.ok(
                    Map.of(
                        "authenticated", false
                    )
                );
            }

            boolean isValid = serviceManager.getSessionService().validateSession(sessionId);
            if(!isValid) {
                return ResponseEntity.ok(
                    Map.of(
                        "authenticated", false
                    )
                ); 
            }

            SessionService.SessionData sessionData = serviceManager.getSessionService().getSession(sessionId);
            if(sessionData == null) {
                return ResponseEntity.ok(
                    Map.of(
                        "authenticated", false
                    )
                );
            }

            return ResponseEntity.ok(
                Map.of(
                    "authenticated", true,
                    "userId", sessionData.getUserId(),
                    "username", sessionData.getUsername(),
                    "sessionType", sessionData.getCurrentSession().getValue(),
                    "lastAcivity", sessionData.getLastActivity(),
                    "timeUntilExpiry", serviceManager.getSessionService().getTimeUntilExpiryMinutes(sessionId)
                )
            );
        } catch(Exception err) {
            return ResponseEntity.ok(
                Map.of(
                    "authenticated", false
                )
            );
        }
    }

    /**
     * Extract Token 
     */
    private String extractTokenFromRequest(HttpServletRequest request) {
        String authHeader = request.getHeader("Authorization");
        if(authHeader != null && authHeader.startsWith("Bearer ")) {
            return authHeader.substring(7);
        }

        Cookie[] cookies = request.getCookies();
        if(cookies != null) {
            for(Cookie cookie : cookies) {
                if("auth_token".equals(cookie.getName())) {
                    return cookie.getValue();
                }
            }
        }

        return null;
    }
}
