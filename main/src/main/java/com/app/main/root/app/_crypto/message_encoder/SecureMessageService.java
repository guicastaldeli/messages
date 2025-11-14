package com.app.main.root.app._crypto.message_encoder;
import org.springframework.stereotype.Service;

@Service
public class SecureMessageService {
    private final MessageEncoderWrapper messageEncoder;
    
    public SecureMessageService() {
        this.messageEncoder = new MessageEncoderWrapper();
        if (!messageEncoder.init()) {
            throw new RuntimeException("Failed to initialize secure message service");
        }
    }
    
    
    public boolean startSession(String recipientId, PreKeyBundle theirBundle) {
        if (!messageEncoder.verifyAndStorePreKeyBundle(theirBundle, recipientId)) {
            return false;
        }

        return messageEncoder.initSession(recipientId, theirBundle);
    }
    
    public byte[] encryptMessage(String recipientId, String message) {
        if (!messageEncoder.hasSession(recipientId)) {
            throw new IllegalStateException("No session with recipient: " + recipientId);
        }
        return messageEncoder.encryptMessage(recipientId, message);
    }
    
    public String decryptMessage(String senderId, byte[] ciphertext) {
        if (!messageEncoder.hasSession(senderId)) {
            throw new IllegalStateException("No session with sender: " + senderId);
        }
        return messageEncoder.decryptMessageToString(senderId, ciphertext);
    }
    
    public boolean hasActiveSession(String participantId) {
        return messageEncoder.hasSession(participantId);
    }
    
    public void rotateKeys(String recipientId) {
        messageEncoder.performKeyRotation(recipientId);
    }
    
    public boolean saveKeys(String filePath) {
        return messageEncoder.saveKeyMaterial(filePath);
    }
    
    public boolean loadKeys(String filePath) {
        return messageEncoder.loadKeyMaterial(filePath);
    }
    
    @Override
    protected void finalize() throws Throwable {
        messageEncoder.cleanup();
        super.finalize();
    }
}