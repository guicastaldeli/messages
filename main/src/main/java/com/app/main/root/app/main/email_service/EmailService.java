package com.app.main.root.app.main.email_service;

import com.app.main.root.EnvConfig;

import jakarta.annotation.PostConstruct;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import javax.mail.internet.InternetAddress;
import javax.mail.internet.MimeMessage;
import java.util.Properties;
import javax.mail.*;

@Component
public class EmailService {
    public final static String WEB_URL_SRC = EnvConfig.get("WEB_URL");
    public final static String RESET_TOKEN = EnvConfig.get("RESET_TOKEN");

    @Autowired private EmailDocumentParser emailDocumentParser;

    @Value("${email.smtp.host:smtp.sendgrid.net}")
    private String smtpHost;

    @Value("${email.smtp.port:587}")
    private String smtpPort;

    @Value("${email.username:apikey}")
    private String emailUsername;

    @Value("${email.password:}")
    private String emailPassword;
    
    @Value("${email.from:app.messages.noreply@gmail.com}")
    private String fromEmail;

    @Value("${web.url:}")
    private String webUrl;

    @Autowired
    private org.springframework.core.env.Environment environment;

    public boolean isValidEmail(String email) {
        String regex = "^[A-Za-z0-9+_.-]+@(.+)$";
        return email != null && email.matches(regex);
    }

    public EmailData getEmailData() {
        return new EmailData(this, emailDocumentParser);
    }

    public void sendEmail(String toEmail, String body) throws MessagingException {
        // Get password from multiple sources with debug output
        String actualPassword = resolvePassword();
        String actualUsername = resolveUsername();
        
        System.out.println("=== Email Debug ===");
        System.out.println("Host: " + smtpHost);
        System.out.println("Port: " + smtpPort);
        System.out.println("Username from prop: " + emailUsername);
        System.out.println("Resolved Username: " + actualUsername);
        System.out.println("Password found: " + (actualPassword != null && !actualPassword.isEmpty()));
        System.out.println("From: " + fromEmail);
        System.out.println("To: " + toEmail);
        System.out.println("===================");
        
        if (actualPassword == null || actualPassword.isEmpty()) {
            throw new MessagingException("Email password not configured. Check email.password property or SENDGRID_API_KEY environment variable.");
        }

        Properties props = new Properties();
        props.put("mail.smtp.host", smtpHost);
        props.put("mail.smtp.port", smtpPort);
        props.put("mail.smtp.auth", "true");
        props.put("mail.smtp.starttls.enable", "true");
        props.put("mail.smtp.connectiontimeout", "10000");
        props.put("mail.smtp.timeout", "10000");
        props.put("mail.smtp.ssl.protocols", "TLSv1.2");
        
        // Important: Set this to debug
        props.put("mail.debug", "true");

        Session session = Session.getInstance(props, new Authenticator() {
            @Override
            protected PasswordAuthentication getPasswordAuthentication() {
                return new PasswordAuthentication(actualUsername, actualPassword);
            }
        });
        
        // Enable session debug
        session.setDebug(true);

        Message message = new MimeMessage(session);
        message.setFrom(new InternetAddress(fromEmail));
        message.setRecipients(Message.RecipientType.TO, InternetAddress.parse(toEmail));
        
        String subject = extractSubject(body);
        message.setSubject(subject);
        
        message.setContent(body, "text/html; charset=utf-8");
        
        Transport.send(message);
        System.out.println("✓ Email sent successfully to: " + toEmail);
    }
    
    private String resolvePassword() {
        // Try property first
        if (emailPassword != null && !emailPassword.isEmpty()) {
            return emailPassword;
        }
        
        // Try environment variable
        String envPassword = System.getenv("SENDGRID_API_KEY");
        if (envPassword != null && !envPassword.isEmpty()) {
            return envPassword;
        }
        
        // Try Spring environment
        if (environment != null) {
            return environment.getProperty("SENDGRID_API_KEY");
        }
        
        return null;
    }
    
    private String resolveUsername() {
        // Always use "apikey" for SendGrid
        return "apikey";
    }
    
    private String extractSubject(String htmlBody) {
        if (htmlBody != null && htmlBody.contains("<title>")) {
            try {
                int start = htmlBody.indexOf("<title>") + 7;
                int end = htmlBody.indexOf("</title>", start);
                if (start > 6 && end > start) {
                    return htmlBody.substring(start, end);
                }
            } catch (Exception e) {
                // Fall through to default
            }
        }
        return "Messages App Notification";
    }

    @PostConstruct
    public void init() {
        System.out.println("=== Email Service Initialized ===");
        System.out.println("SMTP Host: " + smtpHost);
        System.out.println("SMTP Port: " + smtpPort);
        System.out.println("Username from properties: " + emailUsername);
        System.out.println("Password from properties: " + (emailPassword != null && !emailPassword.isEmpty()));
        System.out.println("From Email: " + fromEmail);
        System.out.println("WEB_URL_SRC: " + WEB_URL_SRC);
        System.out.println("=================================");
    }
}