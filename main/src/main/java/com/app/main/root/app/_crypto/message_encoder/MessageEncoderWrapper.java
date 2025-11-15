package com.app.main.root.app._crypto.message_encoder;
import org.springframework.stereotype.Component;
import jakarta.annotation.PostConstruct;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;

@Component
public class MessageEncoderWrapper {
    private static final String DLL_PATH = "src/main/java/com/app/main/root/app/_crypto/message_encoder/.build/";
    
    static {
        loadNativeLibraries();
    }
    
    private static void loadNativeLibraries() {
        try {
            Path directory = Paths.get(DLL_PATH);
            if (!Files.exists(directory)) {
                throw new RuntimeException("DLL directory does not exist: " + directory.toAbsolutePath());
            }
            
            String[] libraries = {
                "libcrypto-3-x64.dll",
                "libssl-3-x64.dll", 
                "message_encoder.dll"
            };
            
            for (String lib : libraries) {
                Path libPath = directory.resolve(lib);
                if (!Files.exists(libPath)) {
                    throw new RuntimeException("Required DLL not found: " + lib);
                }
                System.load(libPath.toAbsolutePath().toString());
                System.out.println("Loaded native library: " + lib);
            }
        } catch (Exception err) {
            throw new RuntimeException("Failed to load native libraries: " + err.getMessage());
        }
    }
    
    private boolean init = false;
    public native boolean initNative();
    public native void cleanupNative();
    public native byte[] getIdentityPublicKey();
    public native PreKeyBundle getPreKeyBundle();
    public native boolean verifyAndStorePreKeyBundle(PreKeyBundle bundle, String recipientId);
    public native boolean initSession(String recipientId, PreKeyBundle bundle);
    public native byte[] encryptMessage(String recipientId, byte[] cipherText);
    public native byte[] decryptMessage(String senderId, byte[] cipherText);
    public native void performKeyRotation(String recipientId);
    public native boolean hasSession(String participantId);
    public native boolean saveKeyMaterial(String filePath);
    public native boolean loadKeyMaterial(String filePath);
    public native boolean saveSessions();
    public native boolean loadSessions();
    public native boolean saveSessionsNow();
    public native boolean loadSessionsNow();
    public native void clearSession(String participantId);

    @PostConstruct
    public synchronized boolean init() {
        if(!init) {
            boolean result = initNative();
            if(result) {
                init = true;
                loadSessions();
            } else {
                System.err.println("MessageEncoder failed");
            }
            return result;
        }
        return true;
    }

    public synchronized void cleanup() {
        if(init) {
            saveSessions();
            loadSessions();
            cleanupNative();
            init = false;
            System.out.println("MessageEncoderWrapper cleaned up");
        }
    }

    public byte[] encryptMessage(String recipientId, String message) {
        if (!init) {
            throw new IllegalStateException("MessageEncoder not initialized");
        }
        byte[] result = encryptMessage(recipientId, message.getBytes());
        saveSessionsNow();
        return result;
    }
    
    public String decryptMessageToString(String senderId, byte[] ciphertext) {
        if (!init) {
            throw new IllegalStateException("MessageEncoder not initialized");
        }
        byte[] plaintext = decryptMessage(senderId, ciphertext);
        saveSessionsNow();
        return new String(plaintext);
    }

    public boolean saveSessionState() {
        if(!init) return false;
        return saveSessions();
    }

    public boolean loadSessionState() {
        if(!init) return false;
        return loadSessions();
    }

    @Override
    protected void finalize() throws Throwable {
        try {
            cleanup();
        } finally {
            super.finalize();
        }
    }
}
