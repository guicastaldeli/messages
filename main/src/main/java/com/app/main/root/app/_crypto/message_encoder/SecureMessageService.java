package com.app.main.root.app._crypto.message_encoder;
import org.springframework.stereotype.Service;

@Service
public class SecureMessageService {
    private final MessageEncoderWrapper messageEncoder;
    
    public SecureMessageService() {
        this.messageEncoder = new MessageEncoderWrapper();
        if(!messageEncoder.init()) {
            throw new RuntimeException("Failed to initialize secure message service");
        }
    }
    
    
    public boolean startSession(String recipientId, PreKeyBundle theirBundle) {
        if(!messageEncoder.verifyAndStorePreKeyBundle(theirBundle, recipientId)) {
            return false;
        }

        return messageEncoder.initSession(recipientId, theirBundle);
    }
    
    public byte[] encryptMessage(String recipientId, String message) {
        System.out.println("Encrypting message for: " + recipientId);
        System.out.println("Original message length: " + message.length());
        
        if(!messageEncoder.hasSession(recipientId)) {
            throw new IllegalStateException("No session with recipient: " + recipientId);
        }
        
        try {
            byte[] encrypted = messageEncoder.encryptMessage(recipientId, message);
            System.out.println("Encryption successful, encrypted length: " + 
                             (encrypted != null ? encrypted.length : "null"));
            return encrypted;
        } catch (Exception e) {
            System.err.println("Encryption failed for " + recipientId + ": " + e.getMessage());
            throw new RuntimeException("Encryption failed", e);
        }
    }
    
    public String decryptMessage(String senderId, byte[] cipherText) {
        System.out.println("Decrypting message from: " + senderId);
        System.out.println("CipherText length: " + (cipherText != null ? cipherText.length : "null"));
        if(!messageEncoder.hasSession(senderId)) {
            System.err.println("No active session for: " + senderId);
            throw new IllegalStateException("No session with sender: " + senderId);
        }
        if(cipherText == null) {
            System.err.println("CipherText is null for: " + senderId);
            throw new IllegalArgumentException("CipherText is null");
        }
        if(cipherText.length == 0) {
            System.err.println("CipherText is empty for: " + senderId);
            throw new IllegalArgumentException("CipherText is empty");
        }
        if(cipherText.length < 16) {
            System.err.println("CipherText too short for: " + senderId + ", length: " + cipherText.length);
            throw new IllegalArgumentException("CipherText too short: " + cipherText.length);
        }
        if(!messageEncoder.hasSession(senderId)) {
            throw new IllegalStateException("No session with sender: " + senderId);
        }
        if(cipherText == null || cipherText.length == 0) {
            throw new IllegalArgumentException("CipherText is null or empty");
        }
        
        try {
            String decrypted = messageEncoder.decryptMessageToString(senderId, cipherText);
            System.out.println("Decryption successful, decrypted length: " + decrypted.length());
            return decrypted;
        } catch (Exception e) {
            System.err.println("Decryption failed from " + senderId + ": " + e.getMessage());
            System.err.println("CipherText hex: " + bytesToHex(cipherText));
            throw new RuntimeException("Decryption failed", e);
        }
    }

    private static String bytesToHex(byte[] bytes) {
        StringBuilder hexString = new StringBuilder();
        for(byte b : bytes) {
            String hex = Integer.toHexString(0xff & b);
            if(hex.length() == 1) hexString.append('0');
            hexString.append(hex);
        }
        return hexString.toString();
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

    public PreKeyBundle getPreKeyBundle() {
        return messageEncoder.getPreKeyBundle();
    }
    
    @Override
    protected void finalize() throws Throwable {
        messageEncoder.cleanup();
        super.finalize();
    }
}