#include "password_encoder.h"
#include <jni.h>
#include <string>
#include <iostream>

#ifdef __cplusplus
extern "C" {
#endif

__declspec(dllexport) JNIEXPORT jlong JNICALL Java_com_app_main_root_app__1crypto_password_1encoder_PasswordEncoderWrapper_createNativeObject(JNIEnv *env, jobject obj) {
    try {
        PasswordEncoder* encoder = new PasswordEncoder();
        return reinterpret_cast<jlong>(encoder);
    } catch (const std::exception& err) {
        std::cerr << "Error creating PasswordEncoder: " << err.what() << std::endl;
        return 0;
    } catch (...) {
        std::cerr << "Unknown error creating PasswordEncoder" << std::endl;
        return 0;
    }
}

__declspec(dllexport) JNIEXPORT void JNICALL Java_com_app_main_root_app__1crypto_password_1encoder_PasswordEncoderWrapper_destroyNativeObject(
    JNIEnv *env, 
    jobject obj,
    jlong nativePtr
) {
    try {
        if(nativePtr != 0) {
            PasswordEncoder* encoder = reinterpret_cast<PasswordEncoder*>(nativePtr);
            delete encoder;
        }
    } catch(const std::exception& err) {
        std::cerr << "Error destroying PasswordEncoder: " << err.what() << std::endl;
    } catch(...) {
        std::cerr << "Unknown error destroying PasswordEncoder" << std::endl;
    }
}

__declspec(dllexport) JNIEXPORT jstring JNICALL Java_com_app_main_root_app__1crypto_password_1encoder_PasswordEncoderWrapper_encodeNative(
    JNIEnv *env, 
    jobject obj,
    jlong nativePtr,
    jstring password
) {
    if(nativePtr == 0 || password == NULL) {
        return NULL;
    }
    
    PasswordEncoder* encoder = reinterpret_cast<PasswordEncoder*>(nativePtr);
    const char* passwordStr = NULL;
    
    try {
        passwordStr = env->GetStringUTFChars(password, NULL);
        if(!passwordStr) return NULL;
        
        std::string result = encoder->encode(std::string(passwordStr));
        env->ReleaseStringUTFChars(password, passwordStr);
        
        return env->NewStringUTF(result.c_str());
    } catch(const std::exception& err) {
        std::cerr << "Error encoding password: " << err.what() << std::endl;
        if(passwordStr) env->ReleaseStringUTFChars(password, passwordStr);
        return NULL;
    } catch(...) {
        std::cerr << "Unknown error encoding password" << std::endl;
        if(passwordStr) env->ReleaseStringUTFChars(password, passwordStr);
        return NULL;
    }
}

__declspec(dllexport) JNIEXPORT jboolean JNICALL Java_com_app_main_root_app__1crypto_password_1encoder_PasswordEncoderWrapper_matchesNative(
    JNIEnv *env, 
    jobject obj,
    jlong nativePtr,
    jstring password,
    jstring encodedPassword
) {
    if(nativePtr == 0 || password == NULL || encodedPassword == NULL) {
        return JNI_FALSE;
    }
    
    PasswordEncoder* encoder = reinterpret_cast<PasswordEncoder*>(nativePtr);
    const char* passwordStr = NULL;
    const char* encodedPasswordStr = NULL;
    
    try {
        passwordStr = env->GetStringUTFChars(password, NULL);
        encodedPasswordStr = env->GetStringUTFChars(encodedPassword, NULL);
        
        if(!passwordStr || !encodedPasswordStr) {
            if (passwordStr) env->ReleaseStringUTFChars(password, passwordStr);
            if (encodedPasswordStr) env->ReleaseStringUTFChars(encodedPassword, encodedPasswordStr);
            return JNI_FALSE;
        }
        
        bool result = encoder->matches(std::string(passwordStr), std::string(encodedPasswordStr));
        
        env->ReleaseStringUTFChars(password, passwordStr);
        env->ReleaseStringUTFChars(encodedPassword, encodedPasswordStr);
        
        return result ? JNI_TRUE : JNI_FALSE;
    } catch(const std::exception& err) {
        std::cerr << "Error matching password: " << err.what() << std::endl;
        if(passwordStr) env->ReleaseStringUTFChars(password, passwordStr);
        if(encodedPasswordStr) env->ReleaseStringUTFChars(encodedPassword, encodedPasswordStr);
        return JNI_FALSE;
    } catch(...) {
        std::cerr << "Unknown error matching password" << std::endl;
        if(passwordStr) env->ReleaseStringUTFChars(password, passwordStr);
        if(encodedPasswordStr) env->ReleaseStringUTFChars(encodedPassword, encodedPasswordStr);
        return JNI_FALSE;
    }
}

__declspec(dllexport) JNIEXPORT jboolean JNICALL Java_com_app_main_root_app__1crypto_password_1encoder_PasswordEncoderWrapper_isPasswordStrongNative(
    JNIEnv *env, 
    jobject obj,
    jlong nativePtr,
    jstring password
) {
    if(nativePtr == 0 || password == NULL) {
        return JNI_FALSE;
    }
    
    PasswordEncoder* encoder = reinterpret_cast<PasswordEncoder*>(nativePtr);
    const char* passwordStr = NULL;
    
    try {
        passwordStr = env->GetStringUTFChars(password, NULL);
        if(!passwordStr) return JNI_FALSE;
        
        bool result = encoder->isPasswordStrong(std::string(passwordStr));
        env->ReleaseStringUTFChars(password, passwordStr);
        
        return result ? JNI_TRUE : JNI_FALSE;
    } catch(const std::exception& err) {
        std::cerr << "Error checking password strength: " << err.what() << std::endl;
        if(passwordStr) env->ReleaseStringUTFChars(password, passwordStr);
        return JNI_FALSE;
    } catch(...) {
        std::cerr << "Unknown error checking password strength" << std::endl;
        if(passwordStr) env->ReleaseStringUTFChars(password, passwordStr);
        return JNI_FALSE;
    }
}

__declspec(dllexport) JNIEXPORT jstring JNICALL Java_com_app_main_root_app__1crypto_password_1encoder_PasswordEncoderWrapper_generateSecurePasswordNative(
    JNIEnv *env, 
    jobject obj,
    jlong nativePtr,
    jint length
) {
    if(nativePtr == 0) {
        return NULL;
    }
    
    PasswordEncoder* encoder = reinterpret_cast<PasswordEncoder*>(nativePtr);
    
    try {
        std::string result = encoder->generateSecurePassword(length);
        return env->NewStringUTF(result.c_str());
    } catch(const std::exception& err) {
        std::cerr << "Error generating secure password: " << err.what() << std::endl;
        return NULL;
    } catch(...) {
        std::cerr << "Unknown error generating secure password" << std::endl;
        return NULL;
    }
}

#ifdef __cplusplus
}
#endif