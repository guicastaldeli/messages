#include "identity_key.h"
#include "../crypto_operations/crypto_operations.h"
#include <stdexcept>

IdentityKeyManager::IdentityKeyManager() : identityKey{nullptr, {}} {
    generateIdentityKey();
}

IdentityKeyManager::~IdentityKeyManager() {
    if(identityKey.keyPair) {
        EC_KEY_free(identityKey.keyPair);
    }
}

void IdentityKeyManager::generateIdentityKey() {
    if(identityKey.keyPair) {
        EC_KEY_free(identityKey.keyPair);
    }
    identityKey.keyPair = CryptoOperations::generateECKey();
    if(!identityKey.keyPair) {
        throw std::runtime_error("Failed to generate identity key");
    }
    identityKey.publicKey = CryptoOperations::serializePublicKey(identityKey.keyPair);
}

std::vector<unsigned char> IdentityKeyManager::getPublicKey() const {
    return identityKey.publicKey;
}

EC_KEY* IdentityKeyManager::getPrivateKey() const {
    return identityKey.keyPair;
}