package com.app.main.root.app._crypto.message_encoder;
import org.springframework.stereotype.Service;

import jakarta.annotation.PostConstruct;
import jakarta.annotation.PreDestroy;

@Service
public class SecureMessageService {
    private final MessageEncoderWrapper messageEncoder;
    private static final String KEYS_FILE_PATH = "src/main/java/com/app/main/root/app/_crypto/message_encoder/keys/sessions.dat";
    
    public SecureMessageService() {
        this.messageEncoder = new MessageEncoderWrapper();
        if(!messageEncoder.init()) {
            throw new RuntimeException("Failed to initialize secure message service");
        }
    }
    
    @PostConstruct
    public void init() {
        try {
            if(!messageEncoder.loadKeyMaterial(KEYS_FILE_PATH)) {
                System.out.println("No existing keys found, generating new keys");
            }
        } catch(Exception err) {
            System.err.println("Failed: " + err.getMessage());
        }
    }

    @PreDestroy
    public void shutdown() {
        try {
            messageEncoder.saveKeyMaterial(KEYS_FILE_PATH);
            messageEncoder.saveSessions();
        } catch(Exception err) {
            System.err.println("Failed **shutdown: " + err.getMessage());
        }
    }
    
    public boolean startSession(String recipientId, PreKeyBundle theirBundle) {
        if(!messageEncoder.verifyAndStorePreKeyBundle(theirBundle, recipientId)) {
            return false;
        }

        boolean result = messageEncoder.initSession(recipientId, theirBundle);
        if(result) messageEncoder.saveSessions();
        return result;
    }
    
    public byte[] encryptMessage(String recipientId, String message) {
        if(!messageEncoder.hasSession(recipientId)) {
            throw new IllegalStateException("No session with recipient: " + recipientId);
        }
        
        try {
            byte[] encrypted = messageEncoder.encryptMessage(recipientId, message);
            return encrypted;
        } catch (Exception e) {
            System.err.println("Encryption failed for " + recipientId + ": " + e.getMessage());
            throw new RuntimeException("Encryption failed", e);
        }
    }
    
    public String decryptMessage(String senderId, byte[] cipherText) {
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
        boolean keysResult = messageEncoder.saveKeyMaterial(filePath);
        boolean sessionsResult = messageEncoder.saveSessions();
        return keysResult && sessionsResult;
    }
    
    public boolean loadKeys(String filePath) {
        boolean keysResult = messageEncoder.loadKeyMaterial(filePath);
        boolean sessionsResult = messageEncoder.loadSessions();
        return keysResult && sessionsResult;
    }

    public boolean saveSessions() {
        return messageEncoder.saveSessions();
    }

    public boolean loadSessions() {
        return messageEncoder.loadSessions();
    }

    public PreKeyBundle getPreKeyBundle() {
        return messageEncoder.getPreKeyBundle();
    }
    
    @Override
    protected void finalize() throws Throwable {
        try {
            saveKeys(KEYS_FILE_PATH);
            saveSessions();
        } finally {
            messageEncoder.cleanup();
            super.finalize();
        }
    }
}