package com.app.main.root.app._auth;
import com.app.main.root.app._server.ConnectionTracker;
import org.springframework.beans.factory.annotation.Autowired;
import jakarta.servlet.http.HttpServletRequest;

public class LoginRequest {
    @Autowired private ConnectionTracker connectionTracker;
    private String email;
    private String password;
    private String sessionId;

    /* Email */
    public void setEmail(String email) {
        this.email = email;
    }
    public String getEmail() {
        return email;
    }

    /* Password */
    public void setPassword(String password) {
        this.password = password;
    }
    public String getPassword() {
        return password;
    }

    /* Session Id */
    public void setSessionId(String sessionId) {
        this.sessionId = sessionId;
    }
    public String getSessionId() {
        return sessionId;
    }

    /* Ip */
    public String getIpAddress(HttpServletRequest httpRequest) {
        return connectionTracker.getClientIpAddress(httpRequest);
    }
}
