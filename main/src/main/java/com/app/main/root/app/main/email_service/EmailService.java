package com.app.main.root.app.main.email_service;
import com.app.main.root.EnvConfig;
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

    @Value("${web.url:{webUrlSrc}}")
    private String webUrl;

    public boolean isValidEmail(String email) {
        String regex = "^[A-Za-z0-9+_.-]+@(.+)$";
        return email != null && email.matches(regex);
    }

    public EmailData getEmailData() {
        return new EmailData(this, emailDocumentParser);
    }

    /**
     * Send Email
     */
    public void sendEmail(String toEmail, String body) throws MessagingException {
        Properties props = new Properties();
        props.put("mail.smtp.host", smtpHost);
        props.put("mail.smtp.port", smtpPort);
        props.put("mail.smtp.auth", "true");
        props.put("mail.smtp.starttls.enable", "true");
        props.put("mail.smtp.connectiontimeout", "5000");
        props.put("mail.smtp.timeout", "5000");
        props.put("mail.smtp.ssl.protocols", "TLSv1.2");

        Session session = Session.getInstance(props, new Authenticator() {
            @Override
            protected PasswordAuthentication getPasswordAuthentication() {
                return new PasswordAuthentication(emailUsername, emailPassword);
            }
        });
        
        session.setDebug(true);

        Message message = new MimeMessage(session);
        message.setFrom(new InternetAddress(fromEmail));
        message.setRecipients(Message.RecipientType.TO, InternetAddress.parse(toEmail));
        
        String subject = extractSubject(body);
        message.setSubject(subject);
        
        message.setContent(body, "text/html; charset=utf-8");
        Transport.send(message);
        
        System.out.println("Email sent successfully to: " + toEmail);
    }
    
    /**
     * Extract subject from HTML body or use default
     */
    private String extractSubject(String htmlBody) {
        if(htmlBody.contains("<title>")) {
            int start = htmlBody.indexOf("<title>") + 7;
            int end = htmlBody.indexOf("</title>", start);
            if(start > 6 && end > start) {
                return htmlBody.substring(start, end);
            }
        }
        return "Messages App Notification";
    }
}