package com.app.main.root.app.main.email_service;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
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
    public void passwordReset(String toEmail, String username, String token) {
        try {
            Map<String, Object> context = new HashMap<>();
            context.put("appName", "Messages");
            context.put("username", username);
            context.put("resetUrl", EmailService.WEB_URL_SRC + "/?action=reset&token=" + token);
            context.put("webUrl", EmailService.WEB_URL_SRC);
            context.put("supportUrl", EmailService.WEB_URL_SRC + "/support");
            
            String body = emailDocumentParser.render("password-reset", context);
            emailService.sendEmail(toEmail, body);
        } catch(Exception err) {
            System.err.println("Password Reset Email error: " + err.getMessage());
            err.printStackTrace();
        }
    }

    /**
     * Password Changed
     */
    public void passwordChanged(String toEmail, String username) {
        try {
            Map<String, Object> context = new HashMap<>();
            context.put("appName", "Messages");
            context.put("username", username);
            context.put("changeTime", LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm")));
            context.put("webUrl", EmailService.WEB_URL_SRC);
            context.put("supportUrl", EmailService.WEB_URL_SRC + "/support");
            context.put("securityUrl", EmailService.WEB_URL_SRC + "/security");
            
            String body = emailDocumentParser.render("password-changed", context);
            emailService.sendEmail(toEmail, body);
        } catch(Exception err) {
            System.err.println("Welcome Email err." + err.getMessage());
            err.printStackTrace();
        }
    }
}
