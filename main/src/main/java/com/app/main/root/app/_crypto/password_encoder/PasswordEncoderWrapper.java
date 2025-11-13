package com.app.main.root.app._crypto.password_encoder;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import org.springframework.stereotype.Component;

@Component
public class PasswordEncoderWrapper {
    private static final String DLL_PATH = "./src/main/java/com/app/main/root/app/_crypto/password_encoder/build/";
    
    static {
        loadNativeLibraries();
    }
    
    private static void loadNativeLibraries() {
        try {
            Path directory = Paths.get(DLL_PATH);
            if (!Files.exists(directory)) {
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
                "passwordencoder.dll"
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
    
    private long nativePtr;
    private final Object lock = new Object();

    public PasswordEncoderWrapper() {
        this.nativePtr = createNativeObject();
        Runtime.getRuntime().addShutdownHook(new Thread(this::destroy));
    }

    private native long createNativeObject();
    private native void destroyNativeObject(long nativePtr);
    private native String encodeNative(long nativePtr, String password);
    private native boolean matchesNative(long nativePtr, String password, String encodedPassword);
    private native boolean isPasswordStrongNative(long nativePtr, String password);
    private native String generateSecurePasswordNative(long nativePtr, int length);

    public String encode(String password) {
        if(password == null || password.trim().isEmpty()) {
            throw new IllegalArgumentException("Password cannot be empty");
        }
        synchronized(lock) {
            return encodeNative(nativePtr, password);
        }
    }

    public boolean matches(String password, String encodedPassword) {
        if(password == null || encodedPassword == null) return false;
        synchronized(lock) {
            return matchesNative(nativePtr, password, encodedPassword);
        }
    }

    public boolean isPasswordStrong(String password) {
        synchronized(lock) {
            return isPasswordStrongNative(nativePtr, password);
        }
    }

    public String generateSecurePassword(int length) {
        synchronized(lock) {
            return generateSecurePasswordNative(nativePtr, length);
        }
    }

    public void destroy() {
        if(nativePtr != 0) {
            destroyNativeObject(nativePtr);
            nativePtr = 0;
        }
    }

    @Override
    protected void finalize() throws Throwable {
        try {
            destroy();
        } finally {
            super.finalize();
        }
    }
}
