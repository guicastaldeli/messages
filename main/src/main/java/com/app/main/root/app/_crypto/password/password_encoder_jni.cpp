#include "password_encoder.h"
#include <jni.h>

#ifdef __cplusplus
extern "C" {
#endif

__declspec(dllexport) JNIEXPORT jlong JNICALL Java_com_app_main_root_app__1crypto_password_PasswordEncoderWrapper_createNativeObject(JNIEnv *env, jobject obj) {
    try {
        PasswordEncoder* encoder = new PasswordEncoder();
        return reinterpret_cast<jlong>(encoder);
    } catch(const std::exception& err) {
        env->ThrowNew(env->FindClass("java/lang/RuntimeException"), err.what());
        return 0;
    }
}

__declspec(dllexport) JNIEXPORT void JNICALL Java_com_app_main_root_app__1crypto_password_PasswordEncoderWrapper_destroyNativeObject(
    JNIEnv *env, 
    jobject obj,
    jlong nativePtr
) {
    PasswordEncoder* encoder = reinterpret_cast<PasswordEncoder*>(nativePtr);
    delete encoder;
}

__declspec(dllexport) JNIEXPORT jstring JNICALL Java_com_app_main_root_app__1crypto_password_PasswordEncoderWrapper_encodeNative(
    JNIEnv *env, 
    jobject obj,
    jlong nativePtr,
    jstring password
) {
    try {
        PasswordEncoder* encoder = reinterpret_cast<PasswordEncoder*>(nativePtr);
        const char* passwordStr = env->GetStringUTFChars(password, nullptr);

        std::string result = encoder->encode(passwordStr);
        env->ReleaseStringUTFChars(password, passwordStr);
        return env->NewStringUTF(result.c_str());
    } catch(const std::exception& err) {
        env-> ThrowNew(env->FindClass("java/lang/RuntimeException"), err.what());
        return nullptr;
    }
}

__declspec(dllexport) JNIEXPORT jboolean JNICALL Java_com_app_main_root_app__1crypto_password_PasswordEncoderWrapper_matchesNative(
    JNIEnv *env, 
    jobject obj,
    jlong nativePtr,
    jstring password,
    jstring encodedPassword
) {
    try {
        PasswordEncoder* encoder = reinterpret_cast<PasswordEncoder*>(nativePtr);
        const char* passwordStr = env->GetStringUTFChars(password, nullptr);
        const char* encodedStr = env->GetStringUTFChars(encodedPassword, nullptr);

        bool result = encoder->matches(passwordStr, encodedStr);
        env->ReleaseStringUTFChars(password, passwordStr);
        env->ReleaseStringUTFChars(encodedPassword, encodedStr);
        return result;
    } catch(const std::exception& err) {
        env->ThrowNew(env->FindClass("java/lang/RuntimeException"), err.what());
        return false;
    }
}

__declspec(dllexport) JNIEXPORT jboolean JNICALL Java_com_app_main_root_app__1crypto_password_PasswordEncoderWrapper_isPasswordStrongNative(
    JNIEnv *env, 
    jobject obj,
    jlong nativePtr,
    jstring password
) {
    try {
        PasswordEncoder* encoder = reinterpret_cast<PasswordEncoder*>(nativePtr);
        const char* passwordStr = env->GetStringUTFChars(password, nullptr);

        bool result = encoder->isPasswordStrong(passwordStr);
        env->ReleaseStringUTFChars(password, passwordStr);
        return result ? JNI_TRUE : JNI_FALSE;
    } catch(const std::exception& err) {
        env->ThrowNew(env->FindClass("java/lang/RuntimeException"), err.what());
        return false;
    }
}

__declspec(dllexport) JNIEXPORT jstring JNICALL Java_com_app_main_root_app__1crypto_password_PasswordEncoderWrapper_generateSecurePasswordNative(
    JNIEnv *env, 
    jobject obj,
    jlong nativePtr,
    jint length
) {
    try {
        PasswordEncoder* encoder = reinterpret_cast<PasswordEncoder*>(nativePtr);
        std::string result = encoder->generateSecurePassword(length);
        return env->NewStringUTF(result.c_str());
    } catch(const std::exception& err) {
        env->ThrowNew(env->FindClass("java/lang/RuntimeException"), err.what());
        return nullptr;
    }
}

#ifdef __cplusplus
}
#endif




