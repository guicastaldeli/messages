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

    /*
    * Validate Registration 
    */
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

    /*
    * Validate Login 
    */
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

    /*
    * Record Registration Attempt 
    */
    public void recordRegistrationAttempt(String ipAddress) {
        if(ipAddress != null) {
            synchronized(lock) {
                recordRegistrationAttemptNative(nativePtr, ipAddress);
            }
        }
    }

    /*
    * Record Login Attempt 
    */
    public void recordLoginAttempt(String ipAddress) {
        if(ipAddress != null) {
            synchronized(lock) {
                recordLoginAttemptNative(nativePtr, ipAddress);
            }
        }
    }

    /*
    * Registration Rate Limited 
    */
    public boolean isRegistrationRateLimited(String ipAddress) {
        if(ipAddress == null) return false;
        synchronized(lock) {
            return isRegistrationRateLimitedNative(nativePtr, ipAddress);
        }
    }

    /*
    * Login Rate Limited 
    */
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
