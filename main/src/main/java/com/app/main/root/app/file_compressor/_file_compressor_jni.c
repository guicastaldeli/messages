#include "_main.h"
#include "comp.h"
#include <jni.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <stdint.h>

JNIEXPORT jbyteArray JNICALL Java_com_app_main_root_app_file_1compressor_FileCompressor_compress(
    JNIEnv* env,
    jclass cls,
    jbyteArray data
) {
    jsize dataLen = (*env)->GetArrayLength(env, data);
    jbyte* dataPtr = (*env)->GetByteArrayElements(env, data, NULL);

    size_t outputSize;
    CompressionType compType;
    uint8_t* compressed = compress(
        (uint8_t*)dataPtr,
        dataLen,
        &outputSize,
        &compType
    );

    jbyteArray result = (*env)->NewByteArray(env, outputSize);
    (*env)->SetByteArrayRegion(env, result, 0, outputSize, (jbyte*)compressed);

    (*env)->ReleaseByteArrayElements(env, data, dataPtr, JNI_ABORT);
    free(compressed);

    return result;
}

JNIEXPORT jobject JNICALL Java_com_app_main_root_app_file_1compressor_WrapperFileCompressor_compressNative(
    JNIEnv *env, jclass clazz, jbyteArray data
) {
    jsize len = (*env)->GetArrayLength(env, data);
    printf("DEBUG JNI: compressNative called, length: %d bytes (%.2f MB)\n", 
           len, len / (1024.0 * 1024.0));
    
    if(len <= 0) {
        printf("INFO JNI: Empty data, returning null\n");
        return NULL;
    }
    
    jbyte *buffer = (*env)->GetByteArrayElements(env, data, NULL);
    
    if(!buffer) {
        printf("ERROR JNI: Cannot get byte array elements for size: %d\n", len);
        return NULL;
    }

    printf("DEBUG JNI: Got buffer, starting compression...\n");
    
    size_t compressedSize;
    CompressionType compType;
    uint8_t* compressed = NULL;
    
    compressed = compress((uint8_t*)buffer, (size_t)len, &compressedSize, &compType);
    
    (*env)->ReleaseByteArrayElements(env, data, buffer, 0);
    
    if(!compressed) {
        printf("ERROR JNI: Compression returned NULL\n");
        return NULL;
    }
    
    printf("DEBUG JNI: Compression result: %d -> %zu bytes, type: %d\n", 
           len, compressedSize, compType);

    jclass resultClass = (*env)->FindClass(env, "com/app/main/root/app/file_compressor/WithCompressionResult");
    if(!resultClass) {
        printf("ERROR JNI: Cannot find WithCompressionResult class\n");
        free(compressed);
        return NULL;
    }
    
    jmethodID constructor = (*env)->GetMethodID(env, resultClass, "<init>", "([BI)V");
    if(!constructor) {
        printf("ERROR JNI: Cannot find WithCompressionResult constructor\n");
        free(compressed);
        return NULL;
    }
    
    jbyteArray compressedArray = (*env)->NewByteArray(env, (jsize)compressedSize);
    if(!compressedArray) {
        printf("ERROR JNI: Cannot create compressed byte array of size: %zu\n", compressedSize);
        free(compressed);
        return NULL;
    }
    
    (*env)->SetByteArrayRegion(env, compressedArray, 0, (jsize)compressedSize, (jbyte*)compressed);
    free(compressed);
    
    printf("DEBUG JNI: Native compression completed successfully\n");
    
    jobject result = (*env)->NewObject(env, resultClass, constructor, compressedArray, (jint)compType);
    return result;
}

JNIEXPORT jbyteArray JNICALL Java_com_app_main_root_app_file_1compressor_FileCompressor_decompress(
    JNIEnv* env,
    jclass cls,
    jbyteArray data,
    jint compressionType
) {
    jsize dataLen = (*env)->GetArrayLength(env, data);
    jbyte* dataPtr = (*env)->GetByteArrayElements(env, data, NULL);

    size_t outputSize;
    uint8_t* decompressed = decompress(
        (uint8_t*)dataPtr,
        dataLen,
        &outputSize,
        (CompressionType)compressionType
    );

    jbyteArray result = (*env)->NewByteArray(env, outputSize);
    (*env)->SetByteArrayRegion(env, result, 0, outputSize, (jbyte*)decompressed);

    (*env)->ReleaseByteArrayElements(env, data, dataPtr, JNI_ABORT);
    free(decompressed);

    return result;
}

JNIEXPORT jint JNICALL Java_com_app_main_root_app_file_1compressor_FileCompressor_compressFile(
    JNIEnv* env,
    jclass cls,
    jstring inputPath,
    jstring outputPath
) {
    const char* inPath = (*env)->GetStringUTFChars(env, inputPath, NULL);
    const char* outPath = (*env)->GetStringUTFChars(env, outputPath, NULL);

    int result = compressFile(inPath, outPath);

    (*env)->ReleaseStringUTFChars(env, inputPath, inPath);
    (*env)->ReleaseStringUTFChars(env, outputPath, outPath);

    return result;
}

JNIEXPORT jint JNICALL Java_com_app_main_root_app_file_1compressor_FileCompressor_decompressFile(
    JNIEnv* env,
    jclass cls,
    jstring inputPath,
    jstring outputPath
) {
    const char* inPath = (*env)->GetStringUTFChars(env, inputPath, NULL);
    const char* outPath = (*env)->GetStringUTFChars(env, outputPath, NULL);

    int result = decompressFile(inPath, outPath);

    (*env)->ReleaseStringUTFChars(env, inputPath, inPath);
    (*env)->ReleaseStringUTFChars(env, outputPath, outPath);

    return result;
}