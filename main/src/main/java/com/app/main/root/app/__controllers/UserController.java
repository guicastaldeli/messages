package com.app.main.root.app.__controllers;
import org.springframework.context.annotation.Lazy;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import com.app.main.root.app._service.ServiceManager;

@RestController
@RequestMapping("/users")
public class UserController {
    private final ServiceManager serviceManager;

    public UserController(@Lazy ServiceManager serviceManager) {
        this.serviceManager = serviceManager;
    }
}
