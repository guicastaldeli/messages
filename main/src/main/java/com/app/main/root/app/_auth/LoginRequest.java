package com.app.main.root.app._auth;

public class LoginRequest {
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
}
