#include "message_encoder.h"
#include <iostream>
#include <fstream>
#include <random>
#include <openssl/evp.h>
#include <openssl/rand.h>

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

/*
** Init Session
*/
bool MessageEncoder::initSession(
    const std::string& recipientId,
    const PreKeyBundle& bundle
) {
    try {
        EC_KEY* identityKeyPublic = CryptoOperations::deserializePublicKey(bundle.identityKey);
        EC_KEY* signedPreKeyPublic = CryptoOperations::deserializePublicKey(bundle.signedPreKey);
        EC_KEY* preKeyPublic = bundle.preKey.empty() ? nullptr : CryptoOperations::deserializePublicKey(bundle.preKey);

        auto dh1 = CryptoOperations::ECDH(identityManager.getPrivateKey(), signedPreKeyPublic);
        auto dh2 = CryptoOperations::ECDH(preKeyManager.getPreKey(bundle.preKeyId), identityKeyPublic);
        auto dh3 = CryptoOperations::ECDH(preKeyManager.getPreKey(bundle.preKeyId), signedPreKeyPublic);

        std::vector<unsigned char> dhResult = dh1;
        dhResult.insert(dhResult.end(), dh2.begin(), dh2.end());
        dhResult.insert(dhResult.end(), dh3.begin(), dh3.end());

        if(preKeyPublic) {
            auto dh4 = CryptoOperations::ECDH(preKeyManager.getPreKey(bundle.preKeyId), preKeyPublic);
            dhResult.insert(dhResult.end(), dh4.begin(), dh4.end());
            EC_KEY_free(preKeyPublic);
        }
        EC_KEY_free(identityKeyPublic);
        EC_KEY_free(signedPreKeyPublic);

        std::vector<unsigned char> initialRootKey(32, 0);
        auto derivedKeys = KeyDerivation::KDF_RK(initialRootKey, dhResult);

        SessionKeys session;
        session.rootKey = std::vector<unsigned char>(derivedKeys.begin(), derivedKeys.begin() + 32);
        session.chainKeySend = std::vector<unsigned char>(derivedKeys.begin() + 32, derivedKeys.end());
        session.chainKeyReceive = session.chainKeySend;
        session.messageCountSend = 0;
        session.messageCountReceive = 0;
        sessionManager.createSession(recipientId, session);
        preKeyManager.removePreKey(bundle.preKeyId);
        return true;
    } catch(const std::exception& err) {
        std::cerr << "Session init failed: " << err.what() << std::endl;
        return false;
    }
}

/*
** Encrypt Message
*/
std::vector<unsigned char> MessageEncoder::encryptMessage(
    const std::string& recipientId,
    const std::vector<unsigned char>& plainText
) {
    if(!sessionManager.hasSession(recipientId)) {
        throw std::runtime_error("No session established with recipient: " + recipientId);
    }
    SessionKeys& session = sessionManager.getSession(recipientId);

    auto keys = KeyDerivation::KDF_CK(session.chainKeySend);
    std::vector<unsigned char> messageKey(keys.begin(), keys.begin() + 32);
    session.chainKeySend = std::vector<unsigned char>(keys.begin() + 32, keys.end());

    std::vector<unsigned char> iv = AESOperations::generateRandomIV();

    std::vector<unsigned char> aad;
    uint32_t counter = session.messageCountSend;
    aad.insert(
        aad.end(), 
        reinterpret_cast<unsigned char*>(&counter), 
        reinterpret_cast<unsigned char*>(&counter) + sizeof(counter)
    );
    aad.insert(aad.end(), recipientId.begin(), recipientId.end());

    auto cipherText = AESOperations::aesGcmEncrypt(plainText, messageKey, iv, aad);

    std::vector<unsigned char> envelope;
    envelope.insert(
        envelope.end(), 
        reinterpret_cast<unsigned char*>(&counter), 
        reinterpret_cast<unsigned char*>(&counter) + sizeof(counter)
    );
    envelope.insert(envelope.end(), iv.begin(), iv.end());
    envelope.insert(envelope.end(), cipherText.begin(), cipherText.end());
    session.messageCountSend++;
    return envelope;
}

/*
** Decrypt Message
*/
std::vector<unsigned char> MessageEncoder::decryptMessage(
    const std::string& senderId,
    const std::vector<unsigned char>& envelope
) {
    if(!sessionManager.hasSession(senderId)) {
        throw std::runtime_error("No session established with sender: " + senderId);
    }
    SessionKeys& session = sessionManager.getSession(senderId);

    if(envelope.size() < sizeof(uint32_t) + 16 + 16) {
        throw std::runtime_error("Envelope too short!");
    }

    uint32_t counter;
    std::copy(
        envelope.begin(), 
        envelope.begin() + sizeof(counter), 
        reinterpret_cast<unsigned char*>(&counter)
    );
    std::vector<unsigned char> iv(
        envelope.begin() + sizeof(counter), 
        envelope.begin() + sizeof(counter) + 16
    );
    std::vector<unsigned char> cipherText(
        envelope.begin() + sizeof(counter) + 16,                    
        envelope.end()
    );

    auto keys = KeyDerivation::KDF_CK(session.chainKeyReceive);
    std::vector<unsigned char> messageKey(keys.begin(), keys.begin() + 32);
    session.chainKeyReceive = std::vector<unsigned char>(keys.begin() + 32, keys.end());

    std::vector<unsigned char> aad;
    aad.insert(
        aad.end(), 
        reinterpret_cast<unsigned char*>(&counter), 
        reinterpret_cast<unsigned char*>(&counter) + sizeof(counter)
    );
    aad.insert(aad.end(), senderId.begin(), senderId.end());

    auto plainText = AESOperations::aesGcmDecrypt(cipherText, messageKey, iv, aad);
    session.messageCountReceive++;
    return plainText;
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
    } catch (...) {
        EC_KEY_free(newDhKey);
        throw;
    }
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