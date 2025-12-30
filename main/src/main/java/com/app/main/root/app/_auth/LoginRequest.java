package com.app.main.root.app._auth;

public class LoginRequest {
    private String email;
    private String password;
    private String sessionId;
    private boolean rememberUser;

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

    /* Remember User */
    public boolean isRememberUser() {
        return rememberUser;
    }
    public void setRememberUser(boolean rememberUser) {
        this.rememberUser = rememberUser;
    }
}
