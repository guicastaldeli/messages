package com.app.main.root.app._auth;
import com.app.main.root.app._server.ConnectionTracker;
import org.springframework.beans.factory.annotation.Autowired;
import jakarta.servlet.http.HttpServletRequest;

public class RegisterRequest {
    @Autowired private ConnectionTracker connectionTracker;
    private String email;
    private String username;
    private String password;
    private String sessionId;

    /* Email */
    public void setEmail(String email) {
        this.email = email;
    }
    public String getEmail() {
        return email;
    }

    /* Username */
    public void setUsername(String username) {
        this.username = username;
    }
    public String getUsername() {
        return username;
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
 