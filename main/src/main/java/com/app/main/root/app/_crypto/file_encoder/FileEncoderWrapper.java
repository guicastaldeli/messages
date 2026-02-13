package com.app.main.root.app._crypto.file_encoder;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.security.SecureRandom;
import java.util.Arrays;

public class FileEncoderWrapper {
    private static final String DLL_PATH = "src/main/java/com/app/main/root/app/_crypto/file_encoder/.build/";
    
    static {
        loadNativeLibraries();
    }
    
    private static void loadNativeLibraries() {
        try {
            String osName = System.getProperty("os.name").toLowerCase();
            boolean isWindows = osName.contains("win");
            boolean isLinux = osName.contains("nix") || osName.contains("nux") || osName.contains("aix");
            System.out.println("Detected OS: " + osName);
            
            if (isWindows) {
                loadWindowsLibraries();
            } else if (isLinux) {
                loadLinuxLibraries();
            } else {
                throw new RuntimeException("Unsupported OS: " + osName);
            }
        } catch(Exception err) {
            err.printStackTrace();
            throw new RuntimeException("Failed to load native libraries: " + err.getMessage(), err);
        }
    }
    
    private static void loadWindowsLibraries() {
        try {
            Path directory = Paths.get(DLL_PATH);
            if(!Files.exists(directory)) {
                throw new RuntimeException("DLL directory does not exist: " + directory.toAbsolutePath());
            }
            
            System.out.println("Files in dll directory:");
            try {
                Files.list(directory)
                    .filter(path -> path.toString().toLowerCase().endsWith(".dll"))
                    .forEach(path -> System.out.println("  - " + path.getFileName()));
            } catch(Exception err) {
                System.out.println("Error listing directory: " + err.getMessage());
            }

            String[] libraries = {
                "libcrypto-3-x64.dll",
                "libssl-3-x64.dll",
                "fileencoder.dll"
            };
            
            for(String lib : libraries) {
                Path libPath = directory.resolve(lib);
                if(!Files.exists(libPath)) {
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
                } catch(UnsatisfiedLinkError e) {
                    System.err.println("Failed to load: " + lib);
                    System.err.println("Error: " + e.getMessage());
                    throw e;
                }
            }
        } catch(Exception err) {
            err.printStackTrace();
            throw new RuntimeException("Windows library load failed: " + err.getMessage(), err);
        }
    }
    
    private static void loadLinuxLibraries() {
        try {
            try {
                System.loadLibrary("fileencoder");
                System.out.println("Loaded fileencoder from system path");
            } catch(UnsatisfiedLinkError e) {
                Path soPath = Paths.get(DLL_PATH + "libfileencoder.so");
                if(Files.exists(soPath)) {
                    System.load(soPath.toAbsolutePath().toString());
                    System.out.println("Loaded fileencoder from local path: " + soPath);
                } else {
                    throw new RuntimeException("libfileencoder.so not found in system or at: " + soPath);
                }
            }
        } catch(Exception err) {
            err.printStackTrace();
            throw new RuntimeException("Linux library load failed: " + err.getMessage(), err);
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
            for(EncryptionAlgorithm algo : values()) {
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

    public byte[] getTag() {
        synchronized(lock) {
            if(nativePtr == 0) {
                throw new IllegalStateException("Encoder not initialized");
            }
            return getTag(nativePtr);
        }
    }
    private native byte[] getTag(long handle);

    public FileEncoderWrapper() {
        Runtime.getRuntime().addShutdownHook(new Thread(this::destroy));
    }
    
    public void initEncoder(byte[] key, EncryptionAlgorithm algorithm) {
        if(nativePtr != 0) {
            cleanup();
        }
        nativePtr = init(key, algorithm.getValue());
    }
    
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
    
    public byte[] encrypt(byte[] data) {
        synchronized(lock) {
            if(nativePtr == 0) {
                throw new IllegalStateException("Encoder not initialized");
            }
            
            byte[] result = encryptData(nativePtr, data);
            if(result != null) {
                System.out.println("Encrypted data length: " + result.length);
                System.out.println("First 12 bytes (IV): " + bytesToHex(Arrays.copyOf(result, 12)));
                System.out.println("Last 16 bytes (tag): " + bytesToHex(Arrays.copyOfRange(result, result.length-16, result.length)));
            } else {
                System.err.println("Encryption failed - returned null");
            }
            
            return result;
        }
    }

    public boolean encryptFile(String inputPath, String outputPath) {
        if(nativePtr == 0) {
            throw new IllegalStateException("Encoder not initialized");
        }
        return encryptFile(nativePtr, inputPath, outputPath);
    }

    public byte[] encryptData(byte[] data, byte[] key) {
        synchronized(lock) {
            try {
                if(data == null || key == null) {
                    throw new IllegalArgumentException("Data or key is null");
                }
                
                FileEncoderWrapper tempEncoder = new FileEncoderWrapper();
                tempEncoder.initEncoder(key, EncryptionAlgorithm.AES_256_GCM);
                
                byte[] result = tempEncoder.encrypt(data);
                tempEncoder.cleanup();
                
                if(result != null) {
                    System.out.println("Encrypted data length: " + result.length);
                } else {
                    System.err.println("Encryption failed - returned null");
                }
                
                return result;
            } catch(Exception err) {
                System.err.println("ERROR: Encryption failed: " + err.getMessage());
                throw new RuntimeException("Encryption failed", err);
            }
        }
    }
    
    public byte[] decrypt(byte[] encryptedData) {
        synchronized(lock) {
            if(nativePtr == 0) {
                throw new IllegalStateException("Encoder not initialized");
            }
            
            byte[] result = decryptData(nativePtr, encryptedData);
            return result;
        }
    }
    
    public boolean decryptFile(String inputPath, String outputPath) {
        if(nativePtr == 0) {
            throw new IllegalStateException("Encoder not initialized");
        }
        return decryptFile(nativePtr, inputPath, outputPath);
    }

    public byte[] decryptData(byte[] encryptedData, byte[] key) {
        synchronized(lock) {
            try {
                if(encryptedData == null || key == null) {
                    throw new IllegalArgumentException("Encrypted data or key is null");
                }
                
                FileEncoderWrapper tempEncoder = new FileEncoderWrapper();
                tempEncoder.initEncoder(key, EncryptionAlgorithm.AES_256_GCM);
                
                byte[] result = tempEncoder.decrypt(encryptedData);
                tempEncoder.cleanup();
                
                if(result != null) {
                    System.out.println("Decrypted data length: " + result.length);
                } else {
                    System.err.println("Decryption failed - returned null");
                }
                
                return result;
            } catch(Exception err) {
                System.err.println("ERROR: Decryption failed: " + err.getMessage());
                throw new RuntimeException("Decryption failed", err);
            }
        }
    }
    
    public byte[] generateIV() {
        if(nativePtr == 0) {
            throw new IllegalStateException("Encoder not initialized");
        }
        return generateIV(nativePtr);
    }
    
    public static byte[] generateSalt(int length) {
        byte[] salt = new byte[length];
        new SecureRandom().nextBytes(salt);
        return salt;
    }
    
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

    private String bytesToHex(byte[] bytes) {
        StringBuilder result = new StringBuilder();
        for(byte b : bytes) {
            result.append(String.format("%02x", b));
        }
        return result.toString();
    }
}