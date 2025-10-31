package com.app.main.root.app.__controllers;
import org.springframework.context.annotation.Lazy;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import com.app.main.root.app.EventTracker;
import com.app.main.root.app._service.ServiceManager;
import com.app.main.root.app._auth.AuthManager;
import com.app.main.root.app._auth.RegisterRequest;
import com.app.main.root.app._auth.LoginRequest;
import java.util.Map;

@RestController
@RequestMapping("/api/auth")
public class AuthController {
    private final EventTracker eventTracker;
    private final ServiceManager serviceManager;
    private final AuthManager authManager;

    private RegisterRequest registerRequest;
    private LoginRequest loginRequest;

    public AuthController(
        @Lazy AuthManager authManager,
        @Lazy EventTracker eventTracker, 
        @Lazy ServiceManager serviceManager
    ) {
        this.authManager = authManager;
        this.eventTracker = eventTracker;
        this.serviceManager = serviceManager;
    }

    @PostMapping("/register")
    public ResponseEntity<?> registerUser(@RequestBody RegisterRequest request) {
        try {
            System.out.println("Registration attempt for: " + request.getEmail());

            Map<String, Object> result = serviceManager.getUserService().registerUser(
                request.getUsername(),
                request.getEmail(),
                request.getPassword(),
                request.getSessionId()
            );

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

    @PostMapping("/login")
    public ResponseEntity<?> loginUser(@RequestBody LoginRequest request) {
        try {
            System.out.println("Login attempt for: " + request.getEmail());

            Map<String, Object> result = serviceManager.getUserService().loginUser(
                request.getEmail(),
                request.getPassword(),
                request.getSessionId()
            );

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
}
