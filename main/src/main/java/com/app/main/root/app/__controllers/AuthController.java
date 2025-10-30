package com.app.main.root.app.__controllers;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import com.app.main.root.app.EventTracker;
import com.app.main.root.app._service.ServiceManager;
import com.app.main.root.app._auth.AuthManager;
import java.util.Map;

@RestController
@RequestMapping("/api/auth")
public class AuthController {
    private final EventTracker eventTracker;
    private final ServiceManager serviceManager;
    private final AuthManager authManager;

    public AuthController(
        AuthManager authManager,
        EventTracker eventTracker, 
        ServiceManager serviceManager
    ) {
        this.authManager = authManager;
        this.eventTracker = eventTracker;
        this.serviceManager = serviceManager;
    }

    @PostMapping("/register")
    public ResponseEntity<?> registerUser(@RequestBody AuthManager request) {
        try {
            var registerRequest = request.getRegisterRequest();
            System.out.println("Registration attempt for: " + registerRequest.getEmail());

            Map<String, Object> result = serviceManager.getUserService().registerUser(
                registerRequest.getUsername(),
                registerRequest.getEmail(),
                registerRequest.getPassword(),
                registerRequest.getSessionId()
            );

            System.out.println("Registered!:" + registerRequest.getEmail());
            return ResponseEntity.ok(result);
        } catch(Exception err) {
            System.err.println("Registration failed" + err.getMessage());
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
}
