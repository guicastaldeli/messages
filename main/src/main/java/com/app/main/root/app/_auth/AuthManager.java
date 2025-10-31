package com.app.main.root.app._auth;

public class AuthManager {
    public RegisterRequest registerRequest;
    public LoginRequest loginRequest;

    public AuthManager() {
        this.registerRequest = new RegisterRequest();
        this.loginRequest = new LoginRequest();
    }

    /* Register Request */
    public RegisterRequest getRegisterRequest() {
        return registerRequest;
    }

    /* Login Request */
    public LoginRequest getLoginRequest() {
        return loginRequest;
    }
}
