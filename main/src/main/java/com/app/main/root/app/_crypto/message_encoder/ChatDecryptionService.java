package com.app.main.root.app._crypto.message_encoder;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Lazy;
import org.springframework.stereotype.Component;

@Component
public class ChatDecryptionService {
    @Autowired @Lazy private SecureMessageService secureMessageService;

    public String decryptMessage(String chatId, byte[] encryptedContent) {
        try {
            return secureMessageService.decryptMessage(chatId, encryptedContent);
        } catch(Exception e) {
            return "[Encrypted Message]";
        }
    }
}
