package com.app.main.root.app._auth;

public class RegisterRequest {
    private String email;
    private String username;
    private String password;
    private String sessionId;
    private boolean rememberUser;
    private String registrationId;
    private boolean async;

    /**
     * Email
     */
    public void setEmail(String email) {
        this.email = email;
    }
    public String getEmail() {
        return email;
    }

    /**
     * Username
     */
    public void setUsername(String username) {
        this.username = username;
    }
    public String getUsername() {
        return username;
    }

    /**
     * Password
     */
    public void setPassword(String password) {
        this.password = password;
    }
    public String getPassword() {
        return password;
    }

    /**
     * Session Id
     */
    public void setSessionId(String sessionId) {
        this.sessionId = sessionId;
    }
    public String getSessionId() {
        return sessionId;
    }

    /**
     * Remember User
     */
    public boolean isRememberUser() {
        return rememberUser;
    }
    public void setRememberUser(boolean rememberUser) {
        this.rememberUser = rememberUser;
    }

    /**
     * Registration Id
     */
    public String getRegistrationId() {
        return registrationId;
    }
    
    public void setRegistrationId(String registrationId) {
        this.registrationId = registrationId;
    }
    
    /**
     * Async
     */
    public boolean isAsync() {
        return async;
    }
    
    public void setAsync(boolean async) {
        this.async = async;
    }
}
 