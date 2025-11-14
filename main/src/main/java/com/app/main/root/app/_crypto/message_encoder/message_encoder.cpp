#include "message_encoder.h"
#include <iostream>
#include <fstream>
#include <random>
#include <openssl/evp.h>
#include <openssl/rand.h>
#include <sstream>

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
    try {
        EC_KEY* identityKeyPublic = CryptoOperations::deserializePublicKey(bundle.identityKey);
        EC_KEY* signedPreKeyPublic = CryptoOperations::deserializePublicKey(bundle.signedPreKey);
        if(!identityKeyPublic || !signedPreKeyPublic) {
            if(identityKeyPublic) EC_KEY_free(identityKeyPublic);
            if(signedPreKeyPublic) EC_KEY_free(signedPreKeyPublic);
            throw std::runtime_error("Failed to deserialize public keys");
        }

        EC_KEY* ourEphemeralKey = CryptoOperations::generateECKey();
        if(!ourEphemeralKey) {
            EC_KEY_free(identityKeyPublic);
            EC_KEY_free(signedPreKeyPublic);
            throw std::runtime_error("Failed to generate ephemeral key");
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
            throw std::runtime_error("DH computation failed: " + std::string(e.what()));
        }

        std::vector<unsigned char> dhResult;
        dhResult.reserve(dh1.size() + dh2.size() + dh3.size());
        dhResult.insert(dhResult.end(), dh1.begin(), dh1.end());
        dhResult.insert(dhResult.end(), dh2.begin(), dh2.end());
        dhResult.insert(dhResult.end(), dh3.begin(), dh3.end());
        if(!bundle.preKey.empty()) {
            EC_KEY* preKeyPublic = CryptoOperations::deserializePublicKey(bundle.preKey);
            if(preKeyPublic) {
                auto dh4 = CryptoOperations::ECDH(ourEphemeralKey, preKeyPublic);
                dhResult.insert(dhResult.end(), dh4.begin(), dh4.end());
                EC_KEY_free(preKeyPublic);
            }
        }

        std::vector<unsigned char> initialRootKey(32, 0);
        auto derivedKeys = KeyDerivation::KDF_RK(initialRootKey, dhResult);
        if(derivedKeys.size() != 64) {
            throw std::runtime_error("Invalid derived keys length: " + toString(derivedKeys.size()));
        }

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

        if(!bundle.preKey.empty()) {
            preKeyManager.removePreKey(bundle.preKeyId);
        }

        std::cout << "Session initialized with " << recipientId 
                  << " - RootKey: " << session.rootKey.size()
                  << ", ChainKey: " << session.chainKeySend.size() << std::endl;
        return true;
    } catch(const std::exception& err) {
        std::cerr << "Session init failed: " << err.what() << std::endl;
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
        sessionManager.saveSessions();
    } catch (...) {
        EC_KEY_free(newDhKey);
        throw;
    }
}

std::vector<unsigned char> MessageEncoder::encryptMessage(
    const std::string& recipientId,
    const std::vector<unsigned char>& plainText
) {
    if(!sessionManager.hasSession(recipientId)) {
        throw std::runtime_error("No session established with recipient: " + recipientId);
    }
    SessionKeys& session = sessionManager.getSession(recipientId);

    auto keys = KeyDerivation::KDF_CK(session.chainKeySend);
    if(keys.size() != 64) {
        throw std::runtime_error("Invalid keys: " + toString(keys.size()));
    }

    std::vector<unsigned char> messageKey(keys.begin(), keys.begin() + 32);
    std::vector<unsigned char> nextChainKey(keys.begin() + 32, keys.end());
    session.chainKeySend = nextChainKey;

    std::vector<unsigned char> iv = AESOperations::generateRandomIV();

    std::vector<unsigned char> aad;
    uint32_t counter = session.messageCountSend;
    uint32_t networkCounter = htonl(counter);
    
    aad.insert(
        aad.end(), 
        reinterpret_cast<unsigned char*>(&networkCounter), 
        reinterpret_cast<unsigned char*>(&networkCounter) + sizeof(networkCounter)
    );
    aad.insert(aad.end(), recipientId.begin(), recipientId.end());

    auto cipherText = AESOperations::aesGcmEncrypt(plainText, messageKey, iv, aad);

    std::vector<unsigned char> envelope;
    envelope.reserve(sizeof(networkCounter) + iv.size() + cipherText.size());
    envelope.insert(
        envelope.end(), 
        reinterpret_cast<unsigned char*>(&networkCounter), 
        reinterpret_cast<unsigned char*>(&networkCounter) + sizeof(networkCounter)
    );
    envelope.insert(
        envelope.end(), 
        iv.begin(), 
        iv.end()
    );
    envelope.insert(
        envelope.end(), 
        cipherText.begin(), 
        cipherText.end()
    );
    session.messageCountSend++;
    sessionManager.saveSessions();
    return envelope;
}

std::vector<unsigned char> MessageEncoder::decryptMessage(
    const std::string& senderId,
    const std::vector<unsigned char>& envelope
) {
    if(!sessionManager.hasSession(senderId)) {
        throw std::runtime_error("No session established with sender: " + senderId);
    }
    SessionKeys& session = sessionManager.getSession(senderId);

    if(envelope.size() < 33) {
        throw std::runtime_error("Envelope too short: " + toString(envelope.size()));
    }
    uint32_t networkCounter;
    std::copy(
        envelope.begin(), 
        envelope.begin() + sizeof(networkCounter), 
        reinterpret_cast<unsigned char*>(&networkCounter)
    );
    uint32_t counter = ntohl(networkCounter);

    std::vector<unsigned char> iv(
        envelope.begin() + sizeof(networkCounter), 
        envelope.begin() + sizeof(networkCounter) + 12
    );
    
    std::vector<unsigned char> cipherText(
        envelope.begin() + sizeof(networkCounter) + 12,                    
        envelope.end()
    );
    if(cipherText.size() < 16) {
        throw std::runtime_error("Ciphertext too short for tag");
    }

    auto keys = KeyDerivation::KDF_CK(session.chainKeyReceive);
    if(keys.size() != 64) {
        throw std::runtime_error("Invalid keys from KDF_CK: " + toString(keys.size()));
    }
    std::vector<unsigned char> messageKey(keys.begin(), keys.begin() + 32);
    std::vector<unsigned char> nextChainKey(keys.begin() + 32, keys.end());

    std::vector<unsigned char> aad;
    uint32_t aadNetworkCounter = htonl(counter);
    aad.insert(
        aad.end(), 
        reinterpret_cast<unsigned char*>(&aadNetworkCounter), 
        reinterpret_cast<unsigned char*>(&aadNetworkCounter) + sizeof(aadNetworkCounter)
    );
    aad.insert(aad.end(), senderId.begin(), senderId.end());

    auto plainText = AESOperations::aesGcmDecrypt(cipherText, messageKey, iv, aad);
    session.chainKeyReceive = nextChainKey;
    session.messageCountReceive = counter + 1;
    sessionManager.saveSessions();
    return plainText;
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
    } catch (const std::exception& err) {
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
    } catch (const std::exception& err) {
        std::cerr << "Failed to load key material: " << err.what() << std::endl;
        return false;
    }
}

bool MessageEncoder::hasActiveSession(const std::string& participantId) {
    return sessionManager.hasSession(participantId);
}