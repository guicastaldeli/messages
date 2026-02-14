package com.app.main.root.app._crypto.user_validator;
import org.springframework.stereotype.Component;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;

@Component
public class UserValidatorWrapper {
    private static final String DLL_PATH = "src/main/java/com/app/main/root/app/_crypto/user_validator/.build/";
    
    static {
        loadNativeLibraries();
    }
    
    private static void loadNativeLibraries() {
        try {
            String osName = System.getProperty("os.name").toLowerCase();
            boolean isWindows = osName.contains("win");
            boolean isLinux = osName.contains("nix") || osName.contains("nux") || osName.contains("aix");
            System.out.println("Detected OS: " + osName);
            
              if(isWindows) {
                loadWindowsLibraries();
            } else if(isLinux) {
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
                "user_validator.dll"
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
                System.loadLibrary("user_validator");
                System.out.println("Loaded user_validator from system path");
            } catch(UnsatisfiedLinkError e) {
                Path soPath = Paths.get(DLL_PATH + "libuser_validator.so");
                if(Files.exists(soPath)) {
                    System.load(soPath.toAbsolutePath().toString());
                    System.out.println("Loaded user_validator from local path: " + soPath);
                } else {
                    throw new RuntimeException("libuser_validator.so not found in system or at: " + soPath);
                }
            }
        } catch(Exception err) {
            err.printStackTrace();
            throw new RuntimeException("Linux library load failed: " + err.getMessage(), err);
        }
    }

    private long nativePtr;
    private final Object lock = new Object();

    public UserValidatorWrapper() {
        this.nativePtr = createNativeObject();
        Runtime.getRuntime().addShutdownHook(new Thread(this::destroy));
    }

    private native long createNativeObject();
    private native void destroyNativeObject(long nativePtr);
    private native boolean validateRegistrationNative(
        long nativePtr,
        String username,
        String email,
        String password,
        String ipAddress
    );
    private native boolean validateLoginNative(
        long nativePtr,
        String email,
        String password,
        String ipAddress
    );
    private native void recordRegistrationAttemptNative(long nativePtr, String ipAddress);
    private native void recordLoginAttemptNative(long nativePtr, String ipAddress);
    private native boolean isRegistrationRateLimitedNative(long nativePtr, String ipAddress);
    private native boolean isLoginRateLimitedNative(long nativePtr, String ipAddress);

    public boolean validateRegistration(
        String username,
        String email,
        String password,
        String ipAddress
    ) {
        if(
            username == null ||
            email == null ||
            password == null ||
            ipAddress == null
        ) {
            return false;
        }
        synchronized(lock) {
            return validateRegistrationNative(
                nativePtr, 
                username, 
                email, 
                password, 
                ipAddress
            );
        }
    }

    public boolean validateLogin(String email, String password, String ipAddress) {
        if(
            email == null ||
            password == null ||
            ipAddress == null
        ) {
            return false;
        }
        synchronized(lock) {
            return validateLoginNative(
                nativePtr, 
                email, 
                password, 
                ipAddress
            );
        }
    }

    public void recordRegistrationAttempt(String ipAddress) {
        if(ipAddress != null) {
            synchronized(lock) {
                recordRegistrationAttemptNative(nativePtr, ipAddress);
            }
        }
    }

    public void recordLoginAttempt(String ipAddress) {
        if(ipAddress != null) {
            synchronized(lock) {
                recordLoginAttemptNative(nativePtr, ipAddress);
            }
        }
    }

    public boolean isRegistrationRateLimited(String ipAddress) {
        if(ipAddress == null) return false;
        synchronized(lock) {
            return isRegistrationRateLimitedNative(nativePtr, ipAddress);
        }
    }

    public boolean isLoginRateLimited(String ipAddress) {
        if(ipAddress == null) return false;
        synchronized(lock) {
            return isLoginRateLimitedNative(nativePtr, ipAddress);
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