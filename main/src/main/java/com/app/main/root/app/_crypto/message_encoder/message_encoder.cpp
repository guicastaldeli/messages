#include "message_encoder.h"
#include <iostream>
#include <fstream>
#include <random>
#include <algorithm>
#include <openssl/evp.h>
#include <openssl/rand.h>
#include <sstream>
#include <mutex>

template<typename T>
std::string toString(T value) {
    std::ostringstream os;
    os << value;
    return os.str();
}

#ifdef _WIN32
#include <winsock2.h>
#else
#include <arpa/inet.h>
#endif

MessageEncoder::MessageEncoder() {
    OpenSSL_add_all_algorithms();
    preKeyManager.generatePreKeys(100);
    preKeyManager.generateSignedPreKey(identityManager.getPrivateKey());
}

MessageEncoder::~MessageEncoder() {}

std::vector<unsigned char> MessageEncoder::getIdentityPublicKey() {
    return identityManager.getPublicKey();
}

PreKeyBundle MessageEncoder::getPreKeyBundle() {
    return preKeyManager.getPreKeyBundle(identityManager.getPublicKey());
}

bool MessageEncoder::verifyAndStorePreKeyBundle(
    const PreKeyBundle& bundle,
    const std::string& recipientId
) {
    return CryptoOperations::verifySignature(
        bundle.signedPreKey,
        bundle.signature,
        bundle.identityKey
    );
}

bool MessageEncoder::initSession(
    const std::string& recipientId,
    const PreKeyBundle& bundle
) {
    std::lock_guard<std::mutex> lock(sessionMutex);

    try {
        if(sessionManager.hasSession(recipientId)) sessionManager.removeSession(recipientId);

        EC_KEY* identityKeyPublic = CryptoOperations::deserializePublicKey(bundle.identityKey);
        EC_KEY* signedPreKeyPublic = CryptoOperations::deserializePublicKey(bundle.signedPreKey);
        if(!identityKeyPublic || !signedPreKeyPublic) {
            if(identityKeyPublic) EC_KEY_free(identityKeyPublic);
            if(signedPreKeyPublic) EC_KEY_free(signedPreKeyPublic);
        }

        EC_KEY* ourEphemeralKey = CryptoOperations::generateECKey();
        if(!ourEphemeralKey) {
            EC_KEY_free(identityKeyPublic);
            EC_KEY_free(signedPreKeyPublic);
        }

        std::vector<unsigned char> dh1;
        std::vector<unsigned char> dh2;
        std::vector<unsigned char> dh3;
        try {
            dh1 = CryptoOperations::ECDH(identityManager.getPrivateKey(), signedPreKeyPublic);
            dh2 = CryptoOperations::ECDH(ourEphemeralKey, identityKeyPublic);
            dh3 = CryptoOperations::ECDH(ourEphemeralKey, signedPreKeyPublic);
        } catch(const std::exception& e) {
            EC_KEY_free(identityKeyPublic);
            EC_KEY_free(signedPreKeyPublic);
            EC_KEY_free(ourEphemeralKey);
        }

        std::vector<unsigned char> dhResult;
        dhResult.reserve(dh1.size() + dh2.size() + dh3.size());
        dhResult.insert(dhResult.end(), dh1.begin(), dh1.end());
        dhResult.insert(dhResult.end(), dh2.begin(), dh2.end());
        dhResult.insert(dhResult.end(), dh3.begin(), dh3.end());
        
        if(!bundle.preKey.empty() && bundle.preKeyId != 0) {
            EC_KEY* preKeyPublic = CryptoOperations::deserializePublicKey(bundle.preKey);
            if(preKeyPublic) {
                auto dh4 = CryptoOperations::ECDH(ourEphemeralKey, preKeyPublic);
                dhResult.insert(dhResult.end(), dh4.begin(), dh4.end());
                EC_KEY_free(preKeyPublic);
            }
        }

        std::vector<unsigned char> initialRootKey(32, 0);
        auto derivedKeys = KeyDerivation::KDF_RK(initialRootKey, dhResult);
        if(derivedKeys.size() != 64)  throw std::runtime_error("Invalid derived keys length: " + toString(derivedKeys.size()));

        SessionKeys session;
        session.rootKey = std::vector<unsigned char>(derivedKeys.begin(), derivedKeys.begin() + 32);
        session.chainKeySend = std::vector<unsigned char>(derivedKeys.begin() + 32, derivedKeys.end());
        session.chainKeyReceive = session.chainKeySend;
        session.messageCountSend = 0;
        session.messageCountReceive = 0;
        sessionManager.createSession(recipientId, session);

        EC_KEY_free(identityKeyPublic);
        EC_KEY_free(signedPreKeyPublic);
        EC_KEY_free(ourEphemeralKey);
        if(!bundle.preKey.empty() && bundle.preKeyId != 0) {
            preKeyManager.removePreKey(bundle.preKeyId);
        }
                  
        sessionManager.saveSessions();
        return true;
    } catch(const std::exception& err) {
        std::cerr << "Session initialization failed for " << recipientId << ": " << err.what() << std::endl;
        return false;
    }
}

bool MessageEncoder::saveSessions() {
    return sessionManager.saveSessions();
}

bool MessageEncoder::loadSessions() {
    return sessionManager.loadSessions();
}

void MessageEncoder::performKeyRotation(const std::string& recipientId) {
    if(!sessionManager.hasSession(recipientId)) {
        throw std::runtime_error("No session found for key rotation: " + recipientId);
    }
    SessionKeys& session = sessionManager.getSession(recipientId);

    EC_KEY* newDhKey = CryptoOperations::generateECKey();
    if(!newDhKey) {
        throw std::runtime_error("Failed to generate new DH key for rotation");
    }

    try {
        std::vector<unsigned char> simulatedDhOutput(32);
        RAND_bytes(simulatedDhOutput.data(), 32);
        
        auto newKeys = KeyDerivation::KDF_RK(session.rootKey, simulatedDhOutput);
        session.rootKey = std::vector<unsigned char>(newKeys.begin(), newKeys.begin() + 32);
        session.chainKeySend = std::vector<unsigned char>(newKeys.begin() + 32, newKeys.end());
        session.chainKeyReceive = session.chainKeySend;
        session.messageCountSend = 0;
        session.messageCountReceive = 0;
        
        EC_KEY_free(newDhKey);
    } catch(...) {
        EC_KEY_free(newDhKey);
        throw;
    }
}

std::vector<unsigned char> MessageEncoder::encryptMessage(
    const std::string& recipientId,
    const std::vector<unsigned char>& plainText
) {
    std::lock_guard<std::mutex> lock(sessionMutex);
    
    if(!sessionManager.hasSession(recipientId)) {
        throw std::runtime_error("No session found for recipient: " + recipientId);
    }
    SessionKeys& session = sessionManager.getSession(recipientId);
    
    auto keys = KeyDerivation::KDF_CK(session.chainKeySend);
    if(keys.size() < 64) throw std::runtime_error("Invalid key derivation output");
    
    std::vector<unsigned char> messageKey(keys.begin(), keys.begin() + 32);
    std::vector<unsigned char> nextChainKey(keys.begin() + 32, keys.end());
    session.chainKeySend = nextChainKey;
    session.messageCountSend++;
    
    auto iv = AESOperations::generateRandomIV();
    auto encrypted = AESOperations::aesGcmEncrypt(plainText, messageKey, iv, {});

    std::vector<unsigned char> result;
    uint32_t counter = htonl(session.messageCountSend);
    
    result.insert(
        result.end(), 
        reinterpret_cast<unsigned char*>(&counter),
        reinterpret_cast<unsigned char*>(&counter) + sizeof(counter)
    );
    result.insert(result.end(), encrypted.begin(), encrypted.end());

    sessionManager.saveSessions();
    return result;
}

std::vector<unsigned char> MessageEncoder::decryptMessage(
    const std::string& senderId,
    const std::vector<unsigned char>& cipherText
) {
    std::lock_guard<std::mutex> lock(sessionMutex);

    if(!sessionManager.hasSession(senderId)) {
        throw std::runtime_error("No session found for sender: " + senderId);
    }
    SessionKeys& session = sessionManager.getSession(senderId);

    if(cipherText.size() < sizeof(uint32_t)) {
        throw std::runtime_error("Ciphertext too short for counter");
    }

    uint32_t messageCounter;
    std::copy(
        cipherText.begin(),
        cipherText.begin() + sizeof(messageCounter),
        reinterpret_cast<unsigned char*>(&messageCounter)
    );
    messageCounter = ntohl(messageCounter);

    std::vector<unsigned char> encryptedData(
        cipherText.begin() + sizeof(messageCounter),
        cipherText.end()
    );

    if(encryptedData.size() < AESOperations::IV_LENGTH + AESOperations::AUTH_TAG_LENGTH) {
        throw std::runtime_error("Encrypted data too short");
    }

    std::vector<unsigned char> messageKey;
    auto decryptedIt = session.decryptedMessageKeys.find(messageCounter);
    if(decryptedIt != session.decryptedMessageKeys.end()) {
        messageKey = decryptedIt->second;
    } else {
        if(messageCounter == session.messageCountReceive + 1) {
            auto keys = KeyDerivation::KDF_CK(session.chainKeyReceive);
            if(keys.size() < 64) {
                throw std::runtime_error("Key derivation failed");
            }
            messageKey = std::vector<unsigned char>(keys.begin(), keys.begin() + 32);
            session.chainKeyReceive = std::vector<unsigned char>(keys.begin() + 32, keys.end());
            session.messageCountReceive = messageCounter;
        } else if(messageCounter > session.messageCountReceive + 1) {
            std::vector<unsigned char> currentChainKey = session.chainKeyReceive;
            for(uint32_t i = session.messageCountReceive + 1; i <= messageCounter; i++) {
                auto keys = KeyDerivation::KDF_CK(currentChainKey);
                if(keys.size() < 64) {
                    throw std::runtime_error("Key derivation failed at step " + std::to_string(i));
                }
                auto currentMessageKey = std::vector<unsigned char>(keys.begin(), keys.begin() + 32);
                currentChainKey = std::vector<unsigned char>(keys.begin() + 32, keys.end());
                if(i < messageCounter) {
                    session.skippedMessageKeys[i] = currentMessageKey;
                } else {
                    messageKey = currentMessageKey;
                }
            }
            session.chainKeyReceive = currentChainKey;
            session.messageCountReceive = messageCounter;
        } else if(messageCounter <= session.messageCountReceive) {
            auto skippedIt = session.skippedMessageKeys.find(messageCounter);
            if(skippedIt != session.skippedMessageKeys.end()) {
                messageKey = skippedIt->second;
            } else {
                throw std::runtime_error("Duplicate message or missing key for counter: " + std::to_string(messageCounter));
            }
        }
        session.decryptedMessageKeys[messageCounter] = messageKey;
    }

    auto decrypted = AESOperations::aesGcmDecrypt(encryptedData, messageKey, {});
    if(decrypted.empty()) throw std::runtime_error("Decryption returned empty data");

    //std::cout << "Successfully decrypted message from " << senderId << " with counter " << messageCounter << std::endl;

    sessionManager.saveSessions();
    return decrypted;
}

/*
** Save Key Material
*/
bool MessageEncoder::saveKeyMaterial(const std::string& filePath) {
    try {
        std::ofstream file(filePath, std::ios::binary);
        if(!file) {
            std::cerr << "Failed to open file **save: " << filePath << std::endl;
            return false;
        }

        auto identityPublicKey = identityManager.getPublicKey();
        uint32_t identityKeyLen = identityPublicKey.size();
        file.write(reinterpret_cast<const char*>(&identityKeyLen), sizeof(identityKeyLen));
        file.write(reinterpret_cast<const char*>(identityPublicKey.data()), identityPublicKey.size());

        uint32_t regId = preKeyManager.getRegistrationId();
        file.write(reinterpret_cast<const char*>(&regId), sizeof(regId));

        uint32_t devId = preKeyManager.getDeviceId();
        file.write(reinterpret_cast<const char*>(&devId), sizeof(devId));

        uint32_t preKeysCount = 0;
        file.write(reinterpret_cast<const char*>(&preKeysCount), sizeof(preKeysCount));

        file.close();
        return true;
    } catch(const std::exception& err) {
        std::cerr << "Failed to save key material: " << err.what() << std::endl;
        return false;
    }
}

/*
** Load Key Material
*/
bool MessageEncoder::loadKeyMaterial(const std::string& filePath) {
    try {
        std::ifstream file(filePath, std::ios::binary);
        if(!file) {
            std::cerr << "Failed to open file **load: " << filePath << std::endl;
            return false;
        }

        uint32_t identityKeyLen;
        file.read(reinterpret_cast<char*>(&identityKeyLen), sizeof(identityKeyLen));
        
        std::vector<unsigned char> identityPublicKey(identityKeyLen);
        file.read(reinterpret_cast<char*>(identityPublicKey.data()), identityKeyLen);

        uint32_t regId;
        file.read(reinterpret_cast<char*>(&regId), sizeof(regId));

        uint32_t devId;
        file.read(reinterpret_cast<char*>(&devId), sizeof(devId));

        uint32_t preKeysCount;
        file.read(reinterpret_cast<char*>(&preKeysCount), sizeof(preKeysCount));

        for(uint32_t i = 0; i < preKeysCount; ++i) {
            uint32_t keyId;
            file.read(reinterpret_cast<char*>(&keyId), sizeof(keyId));
            
            uint32_t keyLen;
            file.read(reinterpret_cast<char*>(&keyLen), sizeof(keyLen));
            
            std::vector<unsigned char> keyData(keyLen);
            file.read(reinterpret_cast<char*>(keyData.data()), keyLen);
        }

        file.close();
        return true;
    } catch(const std::exception& err) {
        std::cerr << "Failed to load key material: " << err.what() << std::endl;
        return false;
    }
}

bool MessageEncoder::hasActiveSession(const std::string& participantId) {
    return sessionManager.hasSession(participantId);
}

bool MessageEncoder::saveSessionsNow() {
    std::lock_guard<std::mutex> lock(sessionMutex);
    return sessionManager.saveSessions();
}

bool MessageEncoder::loadSessionsNow() {
    std::lock_guard<std::mutex> lock(sessionMutex);
    return sessionManager.loadSessions();
}