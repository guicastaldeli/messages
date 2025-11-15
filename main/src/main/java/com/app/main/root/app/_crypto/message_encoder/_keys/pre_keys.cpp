#include "pre_keys.h"
#include "../_crypto_operations/crypto_operations.h"
#include <random>
#include <stdexcept>

PreKeyManager::PreKeyManager() : signedPreKey{nullptr, {}, 0} {
    std::random_device rd;
    std::mt19937 gen(rd());
    std::uniform_int_distribution<uint32_t> dis(1, 0x7FFFFFFF);
    registrationId = dis(gen);
    deviceId = 1;
}

PreKeyManager::~PreKeyManager() {
    if(signedPreKey.keyPair) {
        EC_KEY_free(signedPreKey.keyPair);
    }
    
    for(auto& pair : preKeys) {
        if(pair.second) {
            EC_KEY_free(pair.second);
        }
    }
}

void PreKeyManager::generatePreKeys(size_t count) {
    std::random_device rd;
    std::mt19937 gen(rd());
    std::uniform_int_distribution<uint32_t> dis(1, 0x7FFFFFFF);
    
    for(size_t i = 0; i < count; i++) {
        EC_KEY* preKey = CryptoOperations::generateECKey();
        if(!preKey) {
            throw std::runtime_error("Failed to generate pre-key");
        }
        
        uint32_t keyId = dis(gen);
        preKeys[keyId] = preKey;
    }
}

void PreKeyManager::generateSignedPreKey(EC_KEY* identityPrivateKey) {
    if(signedPreKey.keyPair) {
        EC_KEY_free(signedPreKey.keyPair);
    }
    
    signedPreKey.keyPair = CryptoOperations::generateECKey();
    if(!signedPreKey.keyPair) {
        throw std::runtime_error("Failed to generate signed pre-key");
    }
    
    std::vector<unsigned char> preKeyData = CryptoOperations::serializePublicKey(signedPreKey.keyPair);
    signedPreKey.signature = CryptoOperations::calculateSignature(preKeyData, identityPrivateKey);
    
    std::random_device rd;
    std::mt19937 gen(rd());
    std::uniform_int_distribution<uint32_t> dis(1, 1000);
    signedPreKey.keyId = dis(gen);
}

PreKeyBundle PreKeyManager::getPreKeyBundle(const std::vector<unsigned char>& identityPublicKey) {
    PreKeyBundle bundle;
    bundle.registrationId = registrationId;
    bundle.deviceId = deviceId;
    bundle.identityKey = identityPublicKey;
    
    if(!preKeys.empty()) {
        auto it = preKeys.begin();
        bundle.preKeyId = it->first;
        bundle.preKey = CryptoOperations::serializePublicKey(it->second);
    }
    
    bundle.signedPreKey = CryptoOperations::serializePublicKey(signedPreKey.keyPair);
    bundle.signature = signedPreKey.signature;
    return bundle;
}

EC_KEY* PreKeyManager::getPreKey(uint32_t keyId) {
    auto it = preKeys.find(keyId);
    if(it != preKeys.end()) {
        return it->second;
    }
    return nullptr;
}

void PreKeyManager::removePreKey(uint32_t keyId) {
    auto it = preKeys.find(keyId);
    if(it != preKeys.end()) {
        if(it->second) {
            EC_KEY_free(it->second);
        }
        preKeys.erase(it);
    }
}