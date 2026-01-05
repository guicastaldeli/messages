#include <jni.h>
#include <string.h>
#include <stdlib.h>
#include "file_encoder.h"

#define JNI_CLASS_NAME "com/app/main/root/app/_crypto/file_encoder/FileEncoderWrapper"

static int getByteArray(
    JNIEnv *env, 
    jbyteArray jArray,
    uint8_t **buffer, 
    size_t *length
) {
    if(!jArray) {
        return ENCODER_ERROR_INVALID_PARAM;
    }
    
    jsize len = (*env)->GetArrayLength(env, jArray);
    if(len <= 0) {
        return ENCODER_ERROR_INVALID_PARAM;
    }
    
    *buffer = (uint8_t*)malloc(len);
    if(!*buffer) {
        return ENCODER_ERROR_MEMORY;
    }
    
    jbyte *elements = (*env)->GetByteArrayElements(env, jArray, NULL);
    memcpy(*buffer, elements, len);
    (*env)->ReleaseByteArrayElements(env, jArray, elements, 0);
    
    *length = (size_t)len;
    return ENCODER_SUCCESS;
}

static jbyteArray createByteArray(
    JNIEnv *env, 
    const uint8_t *buffer,
    size_t length
) {
    if(!buffer || length == 0) {
        return NULL;
    }
    
    jbyteArray arr = (*env)->NewByteArray(env, (jsize)length);
    if(!arr) {
        return NULL;
    }
    
    (*env)->SetByteArrayRegion(
        env, 
        arr, 
        0, 
        (jsize)length,
        (const jbyte*)buffer
    );
    
    return arr;
}

JNIEXPORT jlong JNICALL 
Java_com_app_main_root_app__1crypto_file_1encoder_FileEncoderWrapper_init(
    JNIEnv *env, 
    jobject obj, 
    jbyteArray keyArray,
    jint algorithm
) {    
    uint8_t *keyData = NULL;
    size_t keyLen = 0;
    
    int result = getByteArray(env, keyArray, &keyData, &keyLen);
    if(result != ENCODER_SUCCESS) {
        return 0;
    }
    
    EncoderContext *ctx = (EncoderContext*)malloc(sizeof(EncoderContext));
    if(!ctx) {
        free(keyData);
        return 0;
    }
    
    result = init(ctx, keyData, keyLen, (EncryptionAlgo)algorithm);
    free(keyData);
    
    if(result != ENCODER_SUCCESS) {
        free(ctx);
        return 0;
    }
    
    return (jlong)(intptr_t)ctx;
}

JNIEXPORT void JNICALL 
Java_com_app_main_root_app__1crypto_file_1encoder_FileEncoderWrapper_cleanup(
    JNIEnv *env, 
    jobject obj, 
    jlong handle
) {
    EncoderContext *ctx = (EncoderContext*)(intptr_t)handle;
    if(ctx) {
        cleanup(ctx);
        free(ctx);
    }
}

JNIEXPORT jbyteArray JNICALL 
Java_com_app_main_root_app__1crypto_file_1encoder_FileEncoderWrapper_encryptData(
    JNIEnv *env, 
    jobject obj, 
    jlong handle, 
    jbyteArray inputArray
) {
    EncoderContext *ctx = (EncoderContext*)(intptr_t)handle;
    if(!ctx) {
        return NULL;
    }
    
    uint8_t *inputData = NULL;
    size_t inputLen = 0;
    
    int result = getByteArray(env, inputArray, &inputData, &inputLen);
    if(result != ENCODER_SUCCESS) {
        return NULL;
    }
    
    size_t maxOutputLen = getEncryptedSize(inputLen, ctx->algo);
    uint8_t *outputData = (uint8_t*)malloc(maxOutputLen);
    if(!outputData) {
        free(inputData);
        return NULL;
    }
    
    size_t outputLen = 0;
    result = encryptData(ctx, inputData, inputLen, outputData, &outputLen);
    free(inputData);
    
    if(result != ENCODER_SUCCESS) {
        free(outputData);
        return NULL;
    }
    
    jbyteArray resultArray = createByteArray(env, outputData, outputLen);
    free(outputData);
    
    return resultArray;
}

JNIEXPORT jbyteArray JNICALL 
Java_com_app_main_root_app__1crypto_file_1encoder_FileEncoderWrapper_decryptData(
    JNIEnv *env, 
    jobject obj, 
    jlong handle, 
    jbyteArray inputArray
) {    
    EncoderContext *ctx = (EncoderContext*)(intptr_t)handle;
    if(!ctx) {
        (*env)->ThrowNew(env, (*env)->FindClass(env, "java/lang/IllegalArgumentException"), 
                        "Invalid encoder context");
        return NULL;
    }
    
    uint8_t *inputData = NULL;
    size_t inputLen = 0;
    
    int result = getByteArray(env, inputArray, &inputData, &inputLen);
    if(result != ENCODER_SUCCESS) {
        if(inputData) free(inputData);
        (*env)->ThrowNew(env, (*env)->FindClass(env, "java/lang/IllegalArgumentException"), 
                        "Failed to get input data");
        return NULL;
    }
    
    size_t maxOutputLen = inputLen - ctx->ivLength - ctx->tagLength;
    if(maxOutputLen <= 0) {
        free(inputData);
        (*env)->ThrowNew(env, (*env)->FindClass(env, "java/lang/IllegalArgumentException"), 
                        "Input data too small for decryption");
        return NULL;
    }
    
    uint8_t *outputData = (uint8_t*)malloc(maxOutputLen);
    if(!outputData) {
        free(inputData);
        (*env)->ThrowNew(env, (*env)->FindClass(env, "java/lang/OutOfMemoryError"), 
                        "Failed to allocate output buffer");
        return NULL;
    }
    
    size_t outputLen = 0;
    result = decryptData(ctx, inputData, inputLen, outputData, &outputLen);
    free(inputData);
    
    if(result != ENCODER_SUCCESS) {
        free(outputData);
        (*env)->ThrowNew(env, (*env)->FindClass(env, "java/lang/IllegalArgumentException"), 
                        "Decryption failed");
        return NULL;
    }
    
    jbyteArray resultArray = createByteArray(env, outputData, outputLen);
    free(outputData);
    
    return resultArray;
}

JNIEXPORT jboolean JNICALL 
Java_com_app_main_root_app__1crypto_file_1encoder_FileEncoderWrapper_encryptFile(
    JNIEnv *env, 
    jobject obj, 
    jlong handle, 
    jstring inputPathStr,
    jstring outputPathStr
) {    
    EncoderContext *ctx = (EncoderContext*)(intptr_t)handle;
    if(!ctx) {
        return JNI_FALSE;
    }
    
    const char *inputPath = (*env)->GetStringUTFChars(env, inputPathStr, NULL);
    const char *outputPath = (*env)->GetStringUTFChars(env, outputPathStr, NULL);
    
    if(!inputPath || !outputPath) {
        if(inputPath) (*env)->ReleaseStringUTFChars(env, inputPathStr, inputPath);
        if(outputPath) (*env)->ReleaseStringUTFChars(env, outputPathStr, outputPath);
        return JNI_FALSE;
    }
    
    int result = encryptFile(inputPath, outputPath, ctx);
    
    (*env)->ReleaseStringUTFChars(env, inputPathStr, inputPath);
    (*env)->ReleaseStringUTFChars(env, outputPathStr, outputPath);
    
    return (result == ENCODER_SUCCESS) ? JNI_TRUE : JNI_FALSE;
}

JNIEXPORT jboolean JNICALL 
Java_com_app_main_root_app__1crypto_file_1encoder_FileEncoderWrapper_decryptFile(
    JNIEnv *env, 
    jobject obj, 
    jlong handle, 
    jstring inputPathStr,
    jstring outputPathStr
) {    
    EncoderContext *ctx = (EncoderContext*)(intptr_t)handle;
    if(!ctx) {
        return JNI_FALSE;
    }
    
    const char *inputPath = (*env)->GetStringUTFChars(env, inputPathStr, NULL);
    const char *outputPath = (*env)->GetStringUTFChars(env, outputPathStr, NULL);
    
    if(!inputPath || !outputPath) {
        if(inputPath) (*env)->ReleaseStringUTFChars(env, inputPathStr, inputPath);
        if(outputPath) (*env)->ReleaseStringUTFChars(env, outputPathStr, outputPath);
        return JNI_FALSE;
    }
    
    int result = decryptFile(inputPath, outputPath, ctx);
    
    (*env)->ReleaseStringUTFChars(env, inputPathStr, inputPath);
    (*env)->ReleaseStringUTFChars(env, outputPathStr, outputPath);
    
    return (result == ENCODER_SUCCESS) ? JNI_TRUE : JNI_FALSE;
}

JNIEXPORT jbyteArray JNICALL 
Java_com_app_main_root_app__1crypto_file_1encoder_FileEncoderWrapper_generateIV(
    JNIEnv *env, 
    jobject obj, 
    jlong handle
) {    
    EncoderContext *ctx = (EncoderContext*)(intptr_t)handle;
    if(!ctx) {
        return NULL;
    }
    
    if(generateIV(ctx) != ENCODER_SUCCESS) {
        return NULL;
    }
    
    return createByteArray(env, ctx->iv, ctx->ivLength);
}

JNIEXPORT jbyteArray JNICALL 
Java_com_app_main_root_app__1crypto_file_1encoder_FileEncoderWrapper_deriveKey(
    JNIEnv *env, 
    jobject obj, 
    jstring passwordStr,
    jbyteArray saltArray,
    jint keyLength
) {
    const char *password = (*env)->GetStringUTFChars(env, passwordStr, NULL);
    if(!password) {
        return NULL;
    }
    
    uint8_t *saltData = NULL;
    size_t saltLen = 0;
    
    int result = getByteArray(env, saltArray, &saltData, &saltLen);
    if(result != ENCODER_SUCCESS) {
        (*env)->ReleaseStringUTFChars(env, passwordStr, password);
        return NULL;
    }
    
    uint8_t *keyData = (uint8_t*)malloc(keyLength);
    if(!keyData) {
        (*env)->ReleaseStringUTFChars(env, passwordStr, password);
        free(saltData);
        return NULL;
    }
    
    result = deriveKey(password, saltData, saltLen, keyData, keyLength);
    
    (*env)->ReleaseStringUTFChars(env, passwordStr, password);
    free(saltData);
    
    if(result != ENCODER_SUCCESS) {
        free(keyData);
        return NULL;
    }
    
    jbyteArray resultArray = createByteArray(env, keyData, keyLength);
    free(keyData);
    
    return resultArray;
}

JNIEXPORT jint JNICALL 
Java_com_app_main_root_app__1crypto_file_1encoder_FileEncoderWrapper_getEncryptedSize(
    JNIEnv *env, 
    jobject obj, 
    jint input_size, 
    jint algorithm
) {
    return (jint)getEncryptedSize(
        input_size,
        (EncryptionAlgo)algorithm);
}

JNIEXPORT jbyteArray JNICALL 
Java_com_app_main_root_app__1crypto_file_1encoder_FileEncoderWrapper_getIV(
    JNIEnv *env, 
    jobject obj, 
    jlong handle
) {
    EncoderContext *ctx = (EncoderContext*)(intptr_t)handle;
    if(!ctx || !ctx->iv) {
        return NULL;
    }
    
    return createByteArray(env, ctx->iv, ctx->ivLength);
}

JNIEXPORT void JNICALL 
Java_com_app_main_root_app__1crypto_file_1encoder_FileEncoderWrapper_setIV(
    JNIEnv *env, 
    jobject obj, 
    jlong handle, 
    jbyteArray ivArray
) {
    EncoderContext *ctx = (EncoderContext*)(intptr_t)handle;
    if(!ctx) {
        return;
    }
    
    uint8_t *ivData = NULL;
    size_t ivLen = 0;
    
    int result = getByteArray(env, ivArray, &ivData, &ivLen);
    if(result != ENCODER_SUCCESS) {
        if(ivData) free(ivData);
        return;
    }
    
    size_t expectedIVLen = getIVSize(ctx->algo);
    if(ivLen != expectedIVLen) {
        free(ivData);
        return;
    }
    
    memcpy(ctx->iv, ivData, expectedIVLen);
    free(ivData);
}

JNIEXPORT jbyteArray JNICALL 
Java_com_app_main_root_app__1crypto_file_1encoder_FileEncoderWrapper_getTag(
    JNIEnv *env, 
    jobject obj, 
    jlong handle
) {
    EncoderContext *ctx = (EncoderContext*)(intptr_t)handle;
    if(!ctx || !ctx->tag) {
        return NULL;
    }
    
    jbyteArray resultArray = (*env)->NewByteArray(env, ctx->tagLength);
    if(resultArray == NULL) {
        return NULL;
    }
    
    (*env)->SetByteArrayRegion(env, resultArray, 0, ctx->tagLength, (jbyte*)ctx->tag);
    return resultArray;
}

static JNINativeMethod methods[] = {
    { "init", "([BI)J", (void*)Java_com_app_main_root_app__1crypto_file_1encoder_FileEncoderWrapper_init },
    { "cleanup", "(J)V", (void*)Java_com_app_main_root_app__1crypto_file_1encoder_FileEncoderWrapper_cleanup },
    { "encryptData", "(J[B)[B", (void*)Java_com_app_main_root_app__1crypto_file_1encoder_FileEncoderWrapper_encryptData },
    { "decryptData", "(J[B)[B", (void*)Java_com_app_main_root_app__1crypto_file_1encoder_FileEncoderWrapper_decryptData },
    { "encryptFile", "(JLjava/lang/String;Ljava/lang/String;)Z", (void*)Java_com_app_main_root_app__1crypto_file_1encoder_FileEncoderWrapper_encryptFile },
    { "decryptFile", "(JLjava/lang/String;Ljava/lang/String;)Z", (void*)Java_com_app_main_root_app__1crypto_file_1encoder_FileEncoderWrapper_decryptFile },
    { "generateIV", "(J)[B", (void*)Java_com_app_main_root_app__1crypto_file_1encoder_FileEncoderWrapper_generateIV },
    { "deriveKey", "(Ljava/lang/String;[BI)[B", (void*)Java_com_app_main_root_app__1crypto_file_1encoder_FileEncoderWrapper_deriveKey },
    { "getEncryptedSize", "(II)I", (void*)Java_com_app_main_root_app__1crypto_file_1encoder_FileEncoderWrapper_getEncryptedSize },
    { "getIV", "(J)[B", (void*)Java_com_app_main_root_app__1crypto_file_1encoder_FileEncoderWrapper_getIV },
    { "setIV", "(J[B)V", (void*)Java_com_app_main_root_app__1crypto_file_1encoder_FileEncoderWrapper_setIV },
    { "getTag", "(J)[B", (void*)Java_com_app_main_root_app__1crypto_file_1encoder_FileEncoderWrapper_getTag }
};

JNIEXPORT jint JNICALL JNI_OnLoad(JavaVM *vm, void *reserved) {
    JNIEnv *env = NULL;
    
    if((*vm)->GetEnv(vm, (void**)&env, JNI_VERSION_1_8) != JNI_OK) {
        return JNI_ERR;
    }
    
    jclass clazz = (*env)->FindClass(env, JNI_CLASS_NAME);
    if(!clazz) {
        return JNI_ERR;
    }
    
    if((*env)->RegisterNatives(
        env, 
        clazz, 
        methods,
        sizeof(methods) / sizeof(methods[0])) != JNI_OK) {
        return JNI_ERR;
    }
    
    return JNI_VERSION_1_8;
}