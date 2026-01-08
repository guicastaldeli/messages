#include "message_encoder.h"
#include <jni.h>
#include <string>
#include <iostream>

static MessageEncoder* messageEncoder = nullptr;

std::vector<unsigned char> jbyteArrayToVector(JNIEnv* env, jbyteArray array) {
    if(array == nullptr) {
        return std::vector<unsigned char>();
    }
    
    jsize len = env->GetArrayLength(array);
    std::vector<unsigned char> result(len);
    jbyte* bytes = env->GetByteArrayElements(array, nullptr);
    
    if(bytes != nullptr) {
        std::copy(bytes, bytes + len, result.begin());
        env->ReleaseByteArrayElements(array, bytes, JNI_ABORT);
    }
    
    return result;
}

jbyteArray vectorToJByteArray(JNIEnv* env, const std::vector<unsigned char>& vec) {
    if(vec.empty()) {
        return env->NewByteArray(0);
    }
    
    jbyteArray result = env->NewByteArray(vec.size());
    if(result != nullptr) {
        env->SetByteArrayRegion(
            result, 
            0, 
            vec.size(), 
            reinterpret_cast<const jbyte*>(vec.data())
        );
    }
    return result;
}

#ifdef __cplusplus
extern "C" {
#endif

/**
 * Init Native Message Encoder
 */
JNIEXPORT jboolean JNICALL Java_com_app_main_root_app__1crypto_message_1encoder_MessageEncoderWrapper_initNative(
    JNIEnv* env, 
    jobject obj
) {
    try {
        if(messageEncoder == nullptr) {
            messageEncoder = new MessageEncoder();
            std::cout << "MessageEncoder initialized successfully" << std::endl;
            return JNI_TRUE;
        }
        return JNI_TRUE;
    } catch(const std::exception& e) {
        std::cerr << "Failed to initialize MessageEncoder: " << e.what() << std::endl;
        return JNI_FALSE;
    } catch(...) {
        std::cerr << "Unknown error initializing MessageEncoder" << std::endl;
        return JNI_FALSE;
    }
}

/**
 * Cleanup Native Message Encoder
 */
JNIEXPORT void JNICALL Java_com_app_main_root_app__1crypto_message_1encoder_MessageEncoderWrapper_cleanupNative(
    JNIEnv* env, 
    jobject obj
) {
    try {
        if(messageEncoder != nullptr) {
            delete messageEncoder;
            messageEncoder = nullptr;
            std::cout << "MessageEncoder cleaned up" << std::endl;
        }
    } catch(const std::exception& e) {
        std::cerr << "Error cleaning up MessageEncoder: " << e.what() << std::endl;
    } catch(...) {
        std::cerr << "Unknown error cleaning up MessageEncoder" << std::endl;
    }
}

/**
 * Get Identity Public Key
 */
JNIEXPORT jbyteArray JNICALL Java_com_app_main_root_app__1crypto_message_1encoder_MessageEncoderWrapper_getIdentityPublicKey(
    JNIEnv* env, 
    jobject obj
) {
    if(messageEncoder == nullptr) {
        std::cerr << "MessageEncoder not initialized" << std::endl;
        return nullptr;
    }
    
    try {
        auto public_key = messageEncoder->getIdentityPublicKey();
        return vectorToJByteArray(env, public_key);
    } catch(const std::exception& e) {
        std::cerr << "Error getting public key: " << e.what() << std::endl;
        return nullptr;
    } catch(...) {
        std::cerr << "Unknown error getting public key" << std::endl;
        return nullptr;
    }
}

/**
 * Get PreKey Bundle
 */
JNIEXPORT jobject JNICALL Java_com_app_main_root_app__1crypto_message_1encoder_MessageEncoderWrapper_getPreKeyBundle(
    JNIEnv* env, 
    jobject obj
) {
    if(messageEncoder == nullptr) {
        std::cerr << "MessageEncoder not initialized" << std::endl;
        return nullptr;
    }
    
    try {
        auto bundle = messageEncoder->getPreKeyBundle();
        
        jclass bundleClass = env->FindClass("com/app/main/root/app/_crypto/message_encoder/PreKeyBundle");
        if(bundleClass == nullptr) {
            std::cerr << "PreKeyBundle class not found" << std::endl;
            return nullptr;
        }
        jmethodID constructor = env->GetMethodID(bundleClass, "<init>", "()V");
        if(constructor == nullptr) {
            std::cerr << "PreKeyBundle constructor not found" << std::endl;
            return nullptr;
        }
        jobject bundleObj = env->NewObject(bundleClass, constructor);
        if(bundleObj == nullptr) {
            std::cerr << "Failed to create PreKeyBundle object" << std::endl;
            return nullptr;
        }
        
        jfieldID regIdField = env->GetFieldID(bundleClass, "registrationId", "I");
        jfieldID deviceIdField = env->GetFieldID(bundleClass, "deviceId", "I");
        jfieldID identityKeyField = env->GetFieldID(bundleClass, "identityKey", "[B");
        jfieldID signedPreKeyField = env->GetFieldID(bundleClass, "signedPreKey", "[B");
        jfieldID signatureField = env->GetFieldID(bundleClass, "signature", "[B");
        jfieldID preKeyIdField = env->GetFieldID(bundleClass, "preKeyId", "I");
        jfieldID preKeyField = env->GetFieldID(bundleClass, "preKey", "[B");
        
        if(regIdField) env->SetIntField(
            bundleObj, 
            regIdField, 
            bundle.registrationId
        );
        if(deviceIdField) env->SetIntField(
            bundleObj, 
            deviceIdField, 
            bundle.deviceId
        );
        if(identityKeyField) env->SetObjectField(
            bundleObj, 
            identityKeyField, 
            vectorToJByteArray(env, bundle.identityKey)
        );
        if(signedPreKeyField) env->SetObjectField(
            bundleObj, 
            signedPreKeyField, 
            vectorToJByteArray(env, bundle.signedPreKey)
        );
        if(signatureField) env->SetObjectField(
            bundleObj, 
            signatureField, 
            vectorToJByteArray(env, bundle.signature)
        );
        if(preKeyIdField) env->SetIntField(
            bundleObj, 
            preKeyIdField, 
            bundle.preKeyId
        );
        if(preKeyField) env->SetObjectField(
            bundleObj, 
            preKeyField, 
            vectorToJByteArray(env, bundle.preKey)
        );
        
        return bundleObj;
    } catch(const std::exception& e) {
        std::cerr << "Error getting pre-key bundle: " << e.what() << std::endl;
        return nullptr;
    } catch(...) {
        std::cerr << "Unknown error getting pre-key bundle" << std::endl;
        return nullptr;
    }
}

/**
 * Verify and Store PreKey Bundle
 */
JNIEXPORT jboolean JNICALL Java_com_app_main_root_app__1crypto_message_1encoder_MessageEncoderWrapper_verifyAndStorePreKeyBundle(
    JNIEnv* env, 
    jobject obj,
    jobject bundleObj,
    jstring recipientId
) {
    if(messageEncoder == nullptr || bundleObj == nullptr || recipientId == nullptr) {
        return JNI_FALSE;
    }
    
    try {
        const char* recipient_str = env->GetStringUTFChars(recipientId, nullptr);
        if(!recipient_str) {
            return JNI_FALSE;
        }
        
        jclass bundleClass = env->GetObjectClass(bundleObj);

        jfieldID identityKeyField = env->GetFieldID(bundleClass, "identityKey", "[B");
        jfieldID signedPreKeyField = env->GetFieldID(bundleClass, "signedPreKey", "[B");
        jfieldID signatureField = env->GetFieldID(bundleClass, "signature", "[B");
        
        jbyteArray identityKeyArray = (jbyteArray)env->GetObjectField(bundleObj, identityKeyField);
        jbyteArray signedPreKeyArray = (jbyteArray)env->GetObjectField(bundleObj, signedPreKeyField);
        jbyteArray signatureArray = (jbyteArray)env->GetObjectField(bundleObj, signatureField);
        
        PreKeyBundle bundle;
        bundle.identityKey = jbyteArrayToVector(env, identityKeyArray);
        bundle.signedPreKey = jbyteArrayToVector(env, signedPreKeyArray);
        bundle.signature = jbyteArrayToVector(env, signatureArray);
        
        bool result = messageEncoder->verifyAndStorePreKeyBundle(bundle, recipient_str);
        
        env->ReleaseStringUTFChars(recipientId, recipient_str);
        return result ? JNI_TRUE : JNI_FALSE;
    } catch(const std::exception& e) {
        std::cerr << "Error verifying pre-key bundle: " << e.what() << std::endl;
        return JNI_FALSE;
    } catch(...) {
        std::cerr << "Unknown error verifying pre-key bundle" << std::endl;
        return JNI_FALSE;
    }
}

/**
 * Init Session
 */
JNIEXPORT jboolean JNICALL Java_com_app_main_root_app__1crypto_message_1encoder_MessageEncoderWrapper_initSession(
    JNIEnv* env, 
    jobject obj,
    jstring recipientId,
    jobject bundleObj
) {
    if(messageEncoder == nullptr || recipientId == nullptr || bundleObj == nullptr) {
        return JNI_FALSE;
    }
    
    try {
        const char* recipient_str = env->GetStringUTFChars(recipientId, nullptr);
        if(!recipient_str) {
            return JNI_FALSE;
        }
        
        jclass bundleClass = env->GetObjectClass(bundleObj);
        
        jfieldID identityKeyField = env->GetFieldID(bundleClass, "identityKey", "[B");
        jfieldID signedPreKeyField = env->GetFieldID(bundleClass, "signedPreKey", "[B");
        jfieldID signatureField = env->GetFieldID(bundleClass, "signature", "[B");
        jfieldID preKeyIdField = env->GetFieldID(bundleClass, "preKeyId", "I");
        jfieldID preKeyField = env->GetFieldID(bundleClass, "preKey", "[B");
        
        PreKeyBundle bundle;
        bundle.identityKey = jbyteArrayToVector(env, (jbyteArray)env->GetObjectField(bundleObj, identityKeyField));
        bundle.signedPreKey = jbyteArrayToVector(env, (jbyteArray)env->GetObjectField(bundleObj, signedPreKeyField));
        bundle.signature = jbyteArrayToVector(env, (jbyteArray)env->GetObjectField(bundleObj, signatureField));
        bundle.preKeyId = env->GetIntField(bundleObj, preKeyIdField);
        bundle.preKey = jbyteArrayToVector(env, (jbyteArray)env->GetObjectField(bundleObj, preKeyField));
        
        bool result = messageEncoder->initSession(recipient_str, bundle);
        
        env->ReleaseStringUTFChars(recipientId, recipient_str);
        return result ? JNI_TRUE : JNI_FALSE;
    } catch(const std::exception& e) {
        std::cerr << "Error initializing session: " << e.what() << std::endl;
        return JNI_FALSE;
    } catch(...) {
        std::cerr << "Unknown error initializing session" << std::endl;
        return JNI_FALSE;
    }
}

/**
 * Encrypt Message
 */
JNIEXPORT jbyteArray JNICALL Java_com_app_main_root_app__1crypto_message_1encoder_MessageEncoderWrapper_encryptMessage(
    JNIEnv* env, 
    jobject obj,
    jstring recipientId, 
    jbyteArray plaintext
) {
    if(messageEncoder == nullptr || recipientId == nullptr || plaintext == nullptr) {
        return nullptr;
    }
    
    try {
        const char* recipient_str = env->GetStringUTFChars(recipientId, nullptr);
        if(!recipient_str) {
            return nullptr;
        }
        
        auto plaintext_vec = jbyteArrayToVector(env, plaintext);
        auto ciphertext = messageEncoder->encryptMessage(recipient_str, plaintext_vec);
        
        env->ReleaseStringUTFChars(recipientId, recipient_str);
        return vectorToJByteArray(env, ciphertext);
    } catch(const std::exception& e) {
        std::cerr << "Error encrypting message: " << e.what() << std::endl;
        return nullptr;
    } catch(...) {
        std::cerr << "Unknown error encrypting message" << std::endl;
        return nullptr;
    }
}

/**
 * Decrypt Message
 */
JNIEXPORT jbyteArray JNICALL Java_com_app_main_root_app__1crypto_message_1encoder_MessageEncoderWrapper_decryptMessage(
    JNIEnv* env, 
    jobject obj,
    jstring senderId,
    jbyteArray ciphertext
) {
    if(messageEncoder == nullptr || senderId == nullptr || ciphertext == nullptr) {
        return nullptr;
    }
    
    try {
        const char* sender_str = env->GetStringUTFChars(senderId, nullptr);
        if(!sender_str) {
            return nullptr;
        }
        
        auto ciphertext_vec = jbyteArrayToVector(env, ciphertext);
        auto plaintext = messageEncoder->decryptMessage(sender_str, ciphertext_vec);
        
        env->ReleaseStringUTFChars(senderId, sender_str);
        return vectorToJByteArray(env, plaintext);
    } catch(const std::exception& e) {
        std::cerr << "Error decrypting message: " << e.what() << std::endl;
        return nullptr;
    } catch(...) {
        std::cerr << "Unknown error decrypting message" << std::endl;
        return nullptr;
    }
}

/**
 * Has Session
 */
JNIEXPORT jboolean JNICALL Java_com_app_main_root_app__1crypto_message_1encoder_MessageEncoderWrapper_hasSession(
    JNIEnv* env, 
    jobject obj,
    jstring participantId
) {
    if(messageEncoder == nullptr || participantId == nullptr) {
        return JNI_FALSE;
    }
    
    try {
        const char* participant_str = env->GetStringUTFChars(participantId, nullptr);
        if(!participant_str) {
            return JNI_FALSE;
        }
        
        bool hasSession = messageEncoder->hasActiveSession(participant_str);
        env->ReleaseStringUTFChars(participantId, participant_str);
        return hasSession ? JNI_TRUE : JNI_FALSE;
    } catch(const std::exception& e) {
        std::cerr << "Error checking session: " << e.what() << std::endl;
        return JNI_FALSE;
    } catch(...) {
        std::cerr << "Unknown error checking session" << std::endl;
        return JNI_FALSE;
    }
}

/**
 * Perform Key Rotation
 */
JNIEXPORT void JNICALL Java_com_app_main_root_app__1crypto_message_1encoder_MessageEncoderWrapper_performKeyRotation(
    JNIEnv* env, 
    jobject obj,
    jstring recipientId
) {
    if(messageEncoder == nullptr || recipientId == nullptr) {
        return;
    }
    
    try {
        const char* recipient_str = env->GetStringUTFChars(recipientId, nullptr);
        if(!recipient_str) {
            return;
        }
        
        messageEncoder->performKeyRotation(recipient_str);
        env->ReleaseStringUTFChars(recipientId, recipient_str);
    } catch(const std::exception& e) {
        std::cerr << "Error performing key rotation: " << e.what() << std::endl;
    } catch(...) {
        std::cerr << "Unknown error performing key rotation" << std::endl;
    }
}

/**
 * Save Key Material
 */
JNIEXPORT jboolean JNICALL Java_com_app_main_root_app__1crypto_message_1encoder_MessageEncoderWrapper_saveKeyMaterial(
    JNIEnv* env, 
    jobject obj,
    jstring filePath
) {
    if(messageEncoder == nullptr || filePath == nullptr) {
        return JNI_FALSE;
    }
    
    try {
        const char* file_path_str = env->GetStringUTFChars(filePath, nullptr);
        if(!file_path_str) {
            return JNI_FALSE;
        }
        
        bool result = messageEncoder->saveKeyMaterial(file_path_str);
        env->ReleaseStringUTFChars(filePath, file_path_str);
        return result ? JNI_TRUE : JNI_FALSE;
    } catch(const std::exception& e) {
        std::cerr << "Error saving key material: " << e.what() << std::endl;
        return JNI_FALSE;
    } catch(...) {
        std::cerr << "Unknown error saving key material" << std::endl;
        return JNI_FALSE;
    }
}

/**
 * Load Key Material
 */
JNIEXPORT jboolean JNICALL Java_com_app_main_root_app__1crypto_message_1encoder_MessageEncoderWrapper_loadKeyMaterial(
    JNIEnv* env, 
    jobject obj,
    jstring filePath
) {
    if(messageEncoder == nullptr || filePath == nullptr) {
        return JNI_FALSE;
    }
    
    try {
        const char* file_path_str = env->GetStringUTFChars(filePath, nullptr);
        if(!file_path_str) {
            return JNI_FALSE;
        }
        
        bool result = messageEncoder->loadKeyMaterial(file_path_str);
        env->ReleaseStringUTFChars(filePath, file_path_str);
        return result ? JNI_TRUE : JNI_FALSE;
    } catch(const std::exception& e) {
        std::cerr << "Error loading key material: " << e.what() << std::endl;
        return JNI_FALSE;
    } catch(...) {
        std::cerr << "Unknown error loading key material" << std::endl;
        return JNI_FALSE;
    }
}

/**
 * Save Sessions
 */
JNIEXPORT jboolean JNICALL Java_com_app_main_root_app__1crypto_message_1encoder_MessageEncoderWrapper_saveSessions(
    JNIEnv* env, 
    jobject obj
) {
    if(messageEncoder == nullptr) {
        std::cerr << "MessageEncoder not initialized" << std::endl;
        return JNI_FALSE;
    }
    
    try {
        bool result = messageEncoder->saveSessions();
        return result ? JNI_TRUE : JNI_FALSE;
    } catch(const std::exception& e) {
        std::cerr << "Error saving sessions: " << e.what() << std::endl;
        return JNI_FALSE;
    } catch(...) {
        std::cerr << "Unknown error saving sessions" << std::endl;
        return JNI_FALSE;
    }
}

/**
 * Load Sessions
 */
JNIEXPORT jboolean JNICALL Java_com_app_main_root_app__1crypto_message_1encoder_MessageEncoderWrapper_loadSessions(
    JNIEnv* env, 
    jobject obj
) {
    if(messageEncoder == nullptr) {
        std::cerr << "MessageEncoder not initialized" << std::endl;
        return JNI_FALSE;
    }
    
    try {
        bool result = messageEncoder->loadSessions();
        return result ? JNI_TRUE : JNI_FALSE;
    } catch(const std::exception& e) {
        std::cerr << "Error loading sessions: " << e.what() << std::endl;
        return JNI_FALSE;
    } catch(...) {
        std::cerr << "Unknown error loading sessions" << std::endl;
        return JNI_FALSE;
    }
}

JNIEXPORT jboolean JNICALL Java_com_app_main_root_app__1crypto_message_1encoder_MessageEncoderWrapper_saveSessionsNow
  (JNIEnv *env, jobject obj) {
    try {
        return messageEncoder->saveSessionsNow();
    } catch(const std::exception& e) {
        std::cerr << "Failed to save sessions: " << e.what() << std::endl;
        return JNI_FALSE;
    }
}

JNIEXPORT jboolean JNICALL Java_com_app_main_root_app__1crypto_message_1encoder_MessageEncoderWrapper_loadSessionsNow
  (JNIEnv *env, jobject obj) {
    try {
        return messageEncoder->loadSessionsNow();
    } catch(const std::exception& e) {
        std::cerr << "Failed to load sessions: " << e.what() << std::endl;
        return JNI_FALSE;
    }
}

#ifdef __cplusplus
}
#endif