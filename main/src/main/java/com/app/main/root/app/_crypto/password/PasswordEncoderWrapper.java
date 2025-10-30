package com.app.main.root.app._crypto.password;
import org.springframework.stereotype.Component;

@Component
public class PasswordEncoderWrapper {
    static {
        System.loadLibrary("passwordencoder");
    }
    private long nativePtr;

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
        return encodeNative(nativePtr, password);
    }

    public boolean matches(String password, String encodedPassword) {
        if(password == null || encodedPassword == null) return false;
        return matchesNative(nativePtr, password, encodedPassword);
    }

    public boolean isPasswordStrong(String password) {
        return isPasswordStrongNative(nativePtr, password);
    }

    public String generateSecurePassword(int length) {
        return generateSecurePasswordNative(length, length);
    }

    public void destroy() {
        if(nativePtr != 0) {
            destroyNativeObject(nativePtr);
            nativePtr = 0;
        }
    }

    @Override
    protected void finalize() throws Throwable {
        destroy();
        super.finalize();
    }
}
