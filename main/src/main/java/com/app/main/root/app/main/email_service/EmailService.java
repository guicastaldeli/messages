package com.app.main.root.app.main.email_service;
import org.springframework.stereotype.Component;

@Component
public class EmailService {
    public boolean isValidEmail(String email) {
        String regex = "^[A-Za-z0-9+_.-]+@(.+)$";
        return email != null && email.matches(regex);
    }
}
