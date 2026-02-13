package com.app.main.root.app.main.email_service;

import com.sendgrid.*;
import com.sendgrid.helpers.mail.Mail;
import com.sendgrid.helpers.mail.objects.Content;
import com.sendgrid.helpers.mail.objects.Email;
import jakarta.annotation.PostConstruct;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import java.io.IOException;

@Component
public class SendGridWebService {
    
    @Value("${email.from:app.messages.noreply@gmail.com}")
    private String fromEmail;
    
    private SendGrid sendGridClient;
    
    @PostConstruct
    public void init() {
        String apiKey = System.getenv("SENDGRID_API_KEY");
        if (apiKey != null && !apiKey.isEmpty()) {
            sendGridClient = new SendGrid(apiKey, true);
            System.out.println("✅ SendGrid client initialized successfully");
            System.out.println("   From email: " + fromEmail);
        } else {
            System.err.println("❌ CRITICAL: SENDGRID_API_KEY not found in environment");
            System.err.println("   Please add it in Render dashboard: Environment → SENDGRID_API_KEY");
        }
    }
    
    public boolean sendEmail(String toEmail, String subject, String htmlBody) {
        // Log the attempt
        System.out.println("\n=== SendGrid Email Attempt ===");
        System.out.println("Time: " + new java.util.Date());
        System.out.println("To: " + toEmail);
        System.out.println("Subject: " + subject);
        System.out.println("From: " + fromEmail);
        
        // Check if client is initialized
        if (sendGridClient == null) {
            System.err.println("❌ SendGrid client not initialized. Check SENDGRID_API_KEY");
            return false;
        }
        
        // Validate email
        if (toEmail == null || toEmail.trim().isEmpty()) {
            System.err.println("❌ Cannot send email: recipient email is empty");
            return false;
        }
        
        try {
            // Build the email
            Email from = new Email(fromEmail);
            Email to = new Email(toEmail);
            Content content = new Content("text/html", htmlBody);
            Mail mail = new Mail(from, subject, to, content);
            
            // TrackingSettings class might not have these methods in version 4.10.2
            // So we'll skip configuring tracking settings entirely
            // The default settings will apply
            
            // Prepare request
            Request request = new Request();
            request.setMethod(Method.POST);
            request.setEndpoint("mail/send");
            request.setBody(mail.build());
            
            System.out.println("📤 Sending request to SendGrid...");
            
            // Send
            Response response = sendGridClient.api(request);
            
            // Log response
            System.out.println("📥 Response received:");
            System.out.println("   Status Code: " + response.getStatusCode());
            
            // Check result
            if (response.getStatusCode() >= 200 && response.getStatusCode() < 300) {
                System.out.println("✅ Email sent successfully to: " + toEmail);
                System.out.println("===============================\n");
                return true;
            } else {
                System.err.println("❌ SendGrid API error:");
                System.err.println("   Status: " + response.getStatusCode());
                System.err.println("   Body: " + response.getBody());
                System.err.println("===============================\n");
                return false;
            }
            
        } catch (IOException e) {
            System.err.println("❌ SendGrid network error: " + e.getMessage());
            e.printStackTrace();
            System.err.println("===============================\n");
            return false;
        } catch (Exception e) {
            System.err.println("❌ Unexpected error: " + e.getMessage());
            e.printStackTrace();
            System.err.println("===============================\n");
            return false;
        }
    }
}