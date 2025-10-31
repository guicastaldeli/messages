package com.app.main.root.app._auth;

public class AuthManager {
    public final RegisterRequest registerRequest;
    public final LoginRequest loginRequest;

    public AuthManager(
        RegisterRequest registerRequest,
        LoginRequest loginRequest
    ) {
        this.registerRequest = registerRequest;
        this.loginRequest = loginRequest;
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
