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
        } catch (Exception err) {
            System.err.println("Encryption failed for " + recipientId + ": " + err.getMessage());
            throw new RuntimeException("Encryption failed", err);
        }
    }
    
    public String decryptMessage(String chatId, byte[] cipherText) {        
        if(!messageEncoder.hasSession(chatId)) {
            System.err.println("No active session for: " + chatId);
            throw new IllegalStateException("No session with sender: " + chatId);
        }
        if(cipherText == null || cipherText.length == 0) {
            System.err.println("CipherText is null/empty for: " + chatId);
            throw new IllegalArgumentException("CipherText is null or empty");
        }
        if(cipherText.length < 16) {
            System.err.println("CipherText too short for: " + chatId + ", length: " + cipherText.length);
            throw new IllegalArgumentException("CipherText too short: " + cipherText.length);
        }
        
        try {
            String decrypted = messageEncoder.decryptMessageToString(chatId, cipherText);
            return decrypted;
        } catch (Exception err) {
            System.err.println("Decryption failed from " + chatId + ": " + err.getMessage());
            System.err.println("CipherText hex: " + bytesToHex(cipherText));
            throw new RuntimeException("Decryption failed", err);
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