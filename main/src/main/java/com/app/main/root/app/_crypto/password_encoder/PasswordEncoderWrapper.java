package com.app.main.root.app._crypto.password_encoder;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import org.springframework.stereotype.Component;

@Component
public class PasswordEncoderWrapper {
    private static final String DLL_PATH = "src/main/java/com/app/main/root/app/_crypto/password_encoder/.build/";
    
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
                "passwordencoder.dll"
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
            // Try system library first
            try {
                System.loadLibrary("passwordencoder");
                System.out.println("Loaded passwordencoder from system path");
            } catch(UnsatisfiedLinkError e) {
                // Fall back to local .so file
                Path soPath = Paths.get(DLL_PATH + "libpasswordencoder.so");
                if(Files.exists(soPath)) {
                    System.load(soPath.toAbsolutePath().toString());
                    System.out.println("Loaded passwordencoder from local path: " + soPath);
                } else {
                    throw new RuntimeException("libpasswordencoder.so not found in system or at: " + soPath);
                }
            }
        } catch(Exception err) {
            err.printStackTrace();
            throw new RuntimeException("Linux library load failed: " + err.getMessage(), err);
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