package com.app.main.root.app._crypto.message_encoder;
import org.springframework.stereotype.Service;
import jakarta.annotation.PostConstruct;
import jakarta.annotation.PreDestroy;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;

@Service
public class SecureMessageService {
    private final MessageEncoderWrapper messageEncoder;
    private static final String KEYS_FILE_PATH = getKeysFilePath();
    private boolean sessionsLoaded = false;
    
    private static String getKeysFilePath() {
        String keysDir = System.getenv("SESSION_KEYS_DIR");
        if(keysDir != null && !keysDir.isEmpty()) {
            String path = keysDir.endsWith("/") ? keysDir : keysDir + "/";
            return path + "session-keys.dat";
        }
        return "src/main/java/com/app/main/root/app/_crypto/message_encoder/keys/session-keys.dat";
    }
    
    public SecureMessageService(MessageEncoderWrapper messageEncoder) {
        this.messageEncoder = messageEncoder;
    }
    
    @PostConstruct
    public void init() {
        try {
            ensureKeysDirectoryExists();
            
            synchronized(this) {
                if(!sessionsLoaded) {
                    boolean loaded = messageEncoder.loadSessionsNow();
                    System.out.println("Sessions loaded from: " + KEYS_FILE_PATH + " - Success: " + loaded);
                    sessionsLoaded = true;
                }
            }
        } catch(Exception err) {
            System.err.println("Failed to load sessions: " + err.getMessage());
            err.printStackTrace();
        }
    }
    
    private void ensureKeysDirectoryExists() {
        try {
            Path keysPath = Paths.get(KEYS_FILE_PATH).getParent();
            if(keysPath != null && !Files.exists(keysPath)) {
                Files.createDirectories(keysPath);
                System.out.println("Created keys directory: " + keysPath.toAbsolutePath());
            }
        } catch(Exception err) {
            System.err.println("Failed to create keys directory: " + err.getMessage());
        }
    }

    @PreDestroy
    public void shutdown() {
        try {
            System.out.println("Saving sessions to: " + KEYS_FILE_PATH);
            messageEncoder.saveKeyMaterial(KEYS_FILE_PATH);
            messageEncoder.saveSessions();
        } catch(Exception err) {
            System.err.println("Failed shutdown: " + err.getMessage());
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
        } catch(Exception err) {
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
        } catch(Exception err) {
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
}