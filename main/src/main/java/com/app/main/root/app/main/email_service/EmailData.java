package com.app.main.root.app.main.email_service;
import java.util.HashMap;
import java.util.Map;

public class EmailData {
    private final EmailService emailService;
    private final EmailDocumentParser emailDocumentParser;

    public EmailData(EmailService emailService, EmailDocumentParser emailDocumentParser) {
        this.emailService = emailService;
        this.emailDocumentParser = emailDocumentParser;
    }

    /**
     * Welcome Email
     */
    public void welcome(String toEmail, String username, String userId) {
        try {
            Map<String, Object> context = new HashMap<>();
            context.put("appName", "Messages");
            context.put("username", username);
            context.put("userId", userId);
            context.put("webUrl", EmailService.WEB_URL_SRC);
    
            String body = emailDocumentParser.render("welcome-email", context);
            emailService.sendEmail(toEmail, body);
        } catch(Exception err) {
            System.err.println("Welcome Email err." + err.getMessage());
            err.printStackTrace();
        }
    }

    /**
     * Reset Password
     */
    public void passwordReset(String toEmail, String username, String userId) {

    }

    /**
     * Password Changed
     */
    public void passwordChanged(String email, String username) {

    }
}
