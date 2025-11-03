#include "user_validator.h"
#include <jni.h>
#include <iostream>

#ifdef __cplusplus
extern "C" {
#endif

__declspec(dllexport) JNIEXPORT jlong JNICALL Java_com_app_main_root_app__1crypto_user_1validator_UserValidatorWrapper_createNativeObject(
    JNIEnv *env,
    jobject obj
) {
    try {
        UserValidator* validator = new UserValidator();
        return reinterpret_cast<jlong>(validator);
    } catch(const std::exception& err) {
        std::cerr << "Error creating UserValidator: " << err.what() << std::endl;
        return 0;
    } catch(...) {
        std::cerr << "Unknown error creating UserValidator " << std::endl;
        return 0;
    }
}

__declspec(dllexport) JNIEXPORT void JNICALL Java_com_app_main_root_app__1crypto_user_1validator_UserValidatorWrapper_destroyNativeObject(
    JNIEnv *env,
    jobject obj,
    jlong nativePtr
) {
    try {
        if(nativePtr != 0) {
            UserValidator* validator = reinterpret_cast<UserValidator*>(nativePtr);
            delete validator;
        }
    } catch(const std::exception& err) {
        std::cerr << "Error destroying UserValidator: " << err.what() << std::endl;
    } catch(...) {
        std::cerr << "Unknown error destroying UserValidator" << std::endl;
    }
}

__declspec(dllexport) JNIEXPORT jboolean JNICALL Java_com_app_main_root_app__1crypto_user_1validator_UserValidatorWrapper_validateRegistrationNative(
    JNIEnv *env,
    jobject obj,
    jlong nativePtr,
    jstring username,
    jstring email,
    jstring password,
    jstring ipAddress
) {
    if(
        nativePtr == 0 ||
        username == NULL ||
        email == NULL ||
        password == NULL ||
        ipAddress == NULL
    ) {
        return JNI_FALSE;
    }

    UserValidator* validator = reinterpret_cast<UserValidator*>(nativePtr);
    const char* usernameStr = NULL;
    const char* emailStr = NULL;
    const char* passwordStr = NULL;
    const char* ipAddressStr = NULL;

    try {
        usernameStr = env->GetStringUTFChars(username, NULL);
        emailStr = env->GetStringUTFChars(email, NULL);
        passwordStr = env->GetStringUTFChars(password, NULL);
        ipAddressStr = env->GetStringUTFChars(ipAddress, NULL);

        if(!usernameStr || !emailStr || !passwordStr || !ipAddressStr) {
            if(usernameStr) env->ReleaseStringUTFChars(username, usernameStr);
            if(emailStr) env->ReleaseStringUTFChars(email, emailStr);
            if(passwordStr) env->ReleaseStringUTFChars(password, passwordStr);
            if(ipAddressStr) env->ReleaseStringUTFChars(ipAddress, ipAddressStr);
            return JNI_FALSE;
        }

        bool result = validator->validateRegistration(
            std::string(usernameStr),
            std::string(emailStr),
            std::string(passwordStr),
            std::string(ipAddressStr)
        );

        env->ReleaseStringUTFChars(username, usernameStr);
        env->ReleaseStringUTFChars(email, emailStr);
        env->ReleaseStringUTFChars(password, passwordStr);
        env->ReleaseStringUTFChars(ipAddress, ipAddressStr);

        return result ? JNI_TRUE : JNI_FALSE;
    } catch(const std::exception& err) {
        std::cerr << "Error validating registration: " << err.what() << std::endl;
        if(usernameStr) env->ReleaseStringUTFChars(username, usernameStr);
        if(emailStr) env->ReleaseStringUTFChars(email, emailStr);
        if(passwordStr) env->ReleaseStringUTFChars(password, passwordStr);
        if(ipAddressStr) env->ReleaseStringUTFChars(ipAddress, ipAddressStr);
        return JNI_FALSE;
    } catch(...) {
        std::cerr << "Unknown error validating registration: " << std::endl;
        if(usernameStr) env->ReleaseStringUTFChars(username, usernameStr);
        if(emailStr) env->ReleaseStringUTFChars(email, emailStr);
        if(passwordStr) env->ReleaseStringUTFChars(password, passwordStr);
        if(ipAddressStr) env->ReleaseStringUTFChars(ipAddress, ipAddressStr);
        return JNI_FALSE;
    }
}

__declspec(dllexport) JNIEXPORT jboolean JNICALL Java_com_app_main_root_app__1crypto_user_1validator_UserValidatorWrapper_validateLoginNative(
    JNIEnv *env,
    jobject obj,
    jlong nativePtr,
    jstring email,
    jstring password,
    jstring ipAddress
) {
    if(
        nativePtr == 0 ||
        email == NULL ||
        password == NULL ||
        ipAddress == NULL
    ) {
        return JNI_FALSE;
    }

    UserValidator* validator = reinterpret_cast<UserValidator*>(nativePtr);
    const char* emailStr = NULL;
    const char* passwordStr = NULL;
    const char* ipAddressStr = NULL;

    try {
        emailStr = env->GetStringUTFChars(email, NULL);
        passwordStr = env->GetStringUTFChars(password, NULL);
        ipAddressStr = env->GetStringUTFChars(ipAddress, NULL);

        if(!emailStr || !passwordStr || ipAddressStr) {
            if(emailStr) env->ReleaseStringUTFChars(email, emailStr);
            if(passwordStr) env->ReleaseStringUTFChars(password, passwordStr);
            if(ipAddressStr) env->ReleaseStringUTFChars(ipAddress, ipAddressStr);
            return JNI_FALSE;
        }

        bool result = validator->validateLogin(
            std::string(emailStr),
            std::string(passwordStr),
            std::string(ipAddressStr)
        );

        env->ReleaseStringUTFChars(email, emailStr);
        env->ReleaseStringUTFChars(password, passwordStr);
        env->ReleaseStringUTFChars(ipAddress, ipAddressStr);

        return result ? JNI_TRUE : JNI_FALSE;
    } catch(const std::exception& err) {
        std::cerr << "Error validating login: " << err.what() << std::endl;
        if(emailStr) env->ReleaseStringUTFChars(email, emailStr);
        if(passwordStr) env->ReleaseStringUTFChars(password, passwordStr);
        if(ipAddressStr) env->ReleaseStringUTFChars(ipAddress, ipAddressStr);
        return JNI_FALSE;
    } catch(...) {
        std::cerr << "Unknown error validating login: " << std::endl;
        if(emailStr) env->ReleaseStringUTFChars(email, emailStr);
        if(passwordStr) env->ReleaseStringUTFChars(password, passwordStr);
        if(ipAddressStr) env->ReleaseStringUTFChars(ipAddress, ipAddressStr);
        return JNI_FALSE;
    }
}

__declspec(dllexport) JNIEXPORT void JNICALL Java_com_app_main_root_app__1crypto_user_1validator_UserValidatorWrapper_recordRegistrationAttemptNative(
    JNIEnv *env,
    jobject obj,
    jlong nativePtr,
    jstring ipAddress
) {
    if(nativePtr == 0 || ipAddress == NULL) return;

    UserValidator* validator = reinterpret_cast<UserValidator*>(nativePtr);
    const char* ipAddressStr = NULL;

    try {
        ipAddressStr = env->GetStringUTFChars(ipAddress, NULL);
        if(!ipAddressStr) return;
        validator->recordRegistrationAttempt(std::string(ipAddressStr));
        env->ReleaseStringUTFChars(ipAddress, ipAddressStr);
    } catch(const std::exception& err) {
        std::cerr << "Error recording registration attempt: " << err.what() << std::endl;
        if(ipAddressStr) env->ReleaseStringUTFChars(ipAddress, ipAddressStr);
    } catch(...) {
        std::cerr << "Unknown error recording registration attempt: " << std::endl;
        if(ipAddressStr) env->ReleaseStringUTFChars(ipAddress, ipAddressStr);
    }
}

__declspec(dllexport) JNIEXPORT void JNICALL Java_com_app_main_root_app__1crypto_user_1validator_UserValidatorWrapper_recordLoginAttemptNative(
    JNIEnv *env,
    jobject obj,
    jlong nativePtr,
    jstring ipAddress
) {
    if(nativePtr == 0 || ipAddress == NULL) return;

    UserValidator* validator = reinterpret_cast<UserValidator*>(nativePtr);
    const char* ipAddressStr = NULL;

    try {
        ipAddressStr = env->GetStringUTFChars(ipAddress, NULL);
        if(!ipAddressStr) return;
        validator->recordLoginAttempt(std::string(ipAddressStr));
        env->ReleaseStringUTFChars(ipAddress, ipAddressStr);
    } catch(const std::exception& err) {
        std::cerr << "Errror recording login attempt: " << err.what() << std::endl;
        if(ipAddressStr) env->ReleaseStringUTFChars(ipAddress, ipAddressStr);
    } catch(...) {
        std::cerr << "Unknown error recording login attempt" << std::endl;
        if(ipAddressStr) env->ReleaseStringUTFChars(ipAddress, ipAddressStr);
    }
}

__declspec(dllexport) JNIEXPORT jboolean JNICALL Java_com_app_main_root_app__1crypto_user_1validator_UserValidatorWrapper_isRegistrationRateLimitedNative(
    JNIEnv *env,
    jobject obj,
    jlong nativePtr,
    jstring ipAddress
) {
    if(nativePtr == 0 || ipAddress == NULL) return JNI_FALSE;

    UserValidator* validator = reinterpret_cast<UserValidator*>(nativePtr);
    const char* ipAddressStr = NULL;

    try {
        ipAddressStr = env->GetStringUTFChars(ipAddress, NULL);
        if(!ipAddressStr) return JNI_FALSE;

        bool result = validator->isRegistrationRateLimited(std::string(ipAddressStr));
        env->ReleaseStringUTFChars(ipAddress, ipAddressStr);
        return result ? JNI_TRUE : JNI_FALSE;
    } catch(const std::exception& err) {
        std::cerr << "Error checking registration rate limit: " << err.what() << std::endl;
        if(ipAddressStr) env->ReleaseStringUTFChars(ipAddress, ipAddressStr);
        return JNI_FALSE;
    } catch(...) {
        std::cerr << "Unknown error checking registration rate limit: " << std::endl;
        if(ipAddressStr) env->ReleaseStringUTFChars(ipAddress, ipAddressStr);
        return JNI_FALSE;
    }
}

__declspec(dllexport) JNIEXPORT jboolean JNICALL Java_com_app_main_root_app__1crypto_user_1validator_UserValidatorWrapper_isLoginRateLimitedNative(
    JNIEnv *env,
    jobject obj,
    jlong nativePtr,
    jstring ipAddress
) {
    if(nativePtr == 0 || ipAddress == NULL) return JNI_FALSE;

    UserValidator* validator = reinterpret_cast<UserValidator*>(nativePtr);
    const char* ipAddressStr = NULL;

    try {
        ipAddressStr = env->GetStringUTFChars(ipAddress, NULL);
        if(!ipAddressStr) return JNI_FALSE;

        bool result = validator->isLoginRateLimited(std::string(ipAddressStr));
        env->ReleaseStringUTFChars(ipAddress, ipAddressStr);
        return result ? JNI_TRUE : JNI_FALSE;
    } catch(const std::exception& err) {
        std::cerr << "Error checking login rate limit: " << err.what() << std::endl;
        if(ipAddressStr) env->ReleaseStringUTFChars(ipAddress, ipAddressStr);
        return JNI_FALSE;
    } catch(...) {
        std::cerr << "Unknown error checking login rate limit: " << std::endl;
        if(ipAddressStr) env->ReleaseStringUTFChars(ipAddress, ipAddressStr);
        return JNI_FALSE;
    }
}

#ifdef __cplusplus
}
#endif