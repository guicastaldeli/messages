package com.app.main.root.app._crypto.file_encoder;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.security.SecureRandom;

public class FileEncoderWrapper {
    private static final String DLL_PATH = "src/main/java/com/app/main/root/app/_crypto/file_encoder/.build/";
    
    static {
        loadNativeLibraries();
    }
    
    private static void loadNativeLibraries() {
        try {
            Path directory = Paths.get(DLL_PATH);
            if(!Files.exists(directory)) {
                throw new RuntimeException("dll directory does not exist: " + directory.toAbsolutePath());
            }
            System.out.println("Files in dll directory:");
            try {
                Files.list(directory)
                    .filter(path -> path.toString().toLowerCase().endsWith(".dll"))
                    .forEach(path -> System.out.println("  - " + path.getFileName()));
            } catch (Exception err) {
                System.out.println("error directory" + err.getMessage());
            }

            String[] libraries = {
                "libcrypto-3-x64.dll",
                "libssl-3-x64.dll", 
                "fileencoder.dll"
            };
            
            for(String lib : libraries) {
                Path libPath = directory.resolve(lib);
                if (!Files.exists(libPath)) {
                    System.err.println("Missing required DLL: " + libPath.toAbsolutePath());
                    throw new RuntimeException("Required DLL not found: " + lib);
                }
                System.out.println("Found: " + libPath.toAbsolutePath());
            }
            for(String lib : libraries) {
                Path libPath = directory.resolve(lib);
                try {
                    System.load(libPath.toAbsolutePath().toString());
                    System.out.println("Successfully loaded: " + lib);
                } catch (UnsatisfiedLinkError e) {
                    System.err.println("Failed to load: " + lib);
                    System.err.println("Error: " + e.getMessage());
                    throw e;
                }
            }
        } catch (Exception err) {
            err.printStackTrace();
            throw new RuntimeException("Failed to load native libraries: " + err.getMessage());
        }
    }
    
    public enum EncryptionAlgorithm {
        AES_256_GCM(0),
        CHACHA20_POLY1305(1),
        XCHACHA20_POLY1305(2);
        
        private final int value;
        
        EncryptionAlgorithm(int value) {
            this.value = value;
        }
        
        public int getValue() {
            return value;
        }
        
        public static EncryptionAlgorithm fromValue(int value) {
            for (EncryptionAlgorithm algo : values()) {
                if(algo.value == value) {
                    return algo;
                }
            }
            return AES_256_GCM;
        }
    }
    
    private long nativePtr = 0;
    private final Object lock = new Object();

    private native byte[] getIV(long handle);
    public native void setIV(long handle, byte[] iv);

    public FileEncoderWrapper() {
        Runtime.getRuntime().addShutdownHook(new Thread(this::destroy));
    }
    
    /**
     * Init w key
     */
    public void initEncoder(byte[] key, EncryptionAlgorithm algorithm) {
        if(nativePtr != 0) {
            cleanup();
        }
        nativePtr = init(key, algorithm.getValue());
    }
    
    /**
     * Init w password
     */
    public void initEncoder(String password, byte[] salt, EncryptionAlgorithm algorithm) {
        if(nativePtr != 0) {
            cleanup();
        }
        
        byte[] key = deriveKey(password, salt, 32);
        nativePtr = init(key, algorithm.getValue());
        
        if(key != null) {
            java.util.Arrays.fill(key, (byte)0);
        }
    }

    public byte[] getIV() {
        if(nativePtr == 0) {
            throw new IllegalStateException("Encoder not initialized");
        }
        return getIV(nativePtr);
    }

    public void setIV(byte[] iv) {
        if(nativePtr == 0) {
            throw new IllegalStateException("Encoder not initialized");
        }
        setIV(nativePtr, iv);
    }

    public int getEncryptedSize(int inputSize, EncryptionAlgorithm algorithm) {
        return getEncryptedSize(inputSize, algorithm.getValue());
    }
    
    private native long init(byte[] key, int algorithm);
    private native void cleanup(long handle);
    private native byte[] encryptData(long handle, byte[] data);
    private native byte[] decryptData(long handle, byte[] encryptedData);
    private native boolean encryptFile(long handle, String inputPath, String outputPath);
    private native boolean decryptFile(long handle, String inputPath, String outputPath);
    private native byte[] generateIV(long handle);
    private native byte[] deriveKey(String password, byte[] salt, int keyLength);
    private native int getEncryptedSize(int inputSize, int algorithm);
    
    /**
     * Encrypt data in memory
     */
    public byte[] encrypt(byte[] data) {
        if(nativePtr == 0) {
            throw new IllegalStateException("Encoder not initialized");
        }
        return encryptData(nativePtr, data);
    }
    
    /**
     * Decrypt data in memory
     */
    public byte[] decrypt(byte[] encryptedData) {
        if(nativePtr == 0) {
            throw new IllegalStateException("Encoder not initialized");
        }
        return decryptData(nativePtr, encryptedData);
    }
    
    /**
     * Encrypt file
     */
    public boolean encryptFile(String inputPath, String outputPath) {
        if(nativePtr == 0) {
            throw new IllegalStateException("Encoder not initialized");
        }
        return encryptFile(nativePtr, inputPath, outputPath);
    }
    
    /**
     * Decrypt file
     */
    public boolean decryptFile(String inputPath, String outputPath) {
        if(nativePtr == 0) {
            throw new IllegalStateException("Encoder not initialized");
        }
        return decryptFile(nativePtr, inputPath, outputPath);
    }
    
    /**
     * Generate random IV
     */
    public byte[] generateIV() {
        if(nativePtr == 0) {
            throw new IllegalStateException("Encoder not initialized");
        }
        return generateIV(nativePtr);
    }
    
    /**
     * Generate random salt
     */
    public static byte[] generateSalt(int length) {
        byte[] salt = new byte[length];
        new SecureRandom().nextBytes(salt);
        return salt;
    }
    
    /**
     * Generate random key
     */
    public static byte[] generateKey(int length) {
        byte[] key = new byte[length];
        new SecureRandom().nextBytes(key);
        return key;
    }
    
    public void cleanup() {
        if(nativePtr != 0) {
            cleanup(nativePtr);
            nativePtr = 0;
        }
    }

    public void destroy() {
        if(nativePtr != 0) {
            nativePtr = 0;
        }
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