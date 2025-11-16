package com.app.main.root.app.main.email_service;
import com.app.main.root.EnvConfig;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import javax.mail.internet.InternetAddress;
import javax.mail.internet.MimeMessage;
import java.util.HashMap;
import java.util.Map;
import java.util.Properties;
import javax.mail.*;

@Component
public class EmailService {
    private String webUrlSrc = EnvConfig.get("WEB_URL");
    @Autowired private EmailDocumentParser emailDocumentParser;

    @Value("${email.smtp.host:smtp.gmail.com}")
    private String smtpHost;

    @Value("${email.smtp.port:587}")
    private String smtpPort;

    @Value("${email.username}")
    private String emailUsername;

    @Value("${email.password}")
    private String emailPassword;

    @Value("${web.url:{webUrlSrc}}")
    private String webUrl;

    public boolean isValidEmail(String email) {
        String regex = "^[A-Za-z0-9+_.-]+@(.+)$";
        return email != null && email.matches(regex);
    }

    public void sendWelcomeEmail(String toEmail, String username, String userId) {
        try {
            Map<String, Object> context = new HashMap<>();
            context.put("appName", "Messages");
            context.put("username", username);
            context.put("userId", userId);
            context.put("webUrl", webUrlSrc);
    
            String body = emailDocumentParser.render("welcome-email", context);
            sendEmail(toEmail, body);
        } catch(Exception err) {
            System.err.println("Welcome Email err." + err.getMessage());
            err.printStackTrace();
        }
    }

    private void sendEmail(String toEmail, String body) throws MessagingException {
        Properties props = new Properties();
        props.put("mail.smtp.host", smtpHost);
        props.put("mail.smtp.port", smtpPort);
        props.put("mail.smtp.auth", "true");
        props.put("mail.smtp.starttls.enable", "true");

        Session session = Session.getInstance(props, new Authenticator() {
            @Override
            protected PasswordAuthentication getPasswordAuthentication() {
                return new PasswordAuthentication(emailUsername, emailPassword);
            }
        });

        Message message = new MimeMessage(session);
        message.setFrom(new InternetAddress(emailUsername));
        message.setRecipients(Message.RecipientType.TO, InternetAddress.parse(toEmail));
        message.setContent(body, "text/html; charset=utf-8");
        Transport.send(message);
    }
}
