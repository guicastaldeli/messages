package com.app.main.root.app._auth;

public class AuthManager {
    private final RegisterRequest registerRequest;
    private final LoginRequest loginRequest;

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
