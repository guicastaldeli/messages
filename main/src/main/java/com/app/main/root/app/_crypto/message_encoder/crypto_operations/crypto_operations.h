#ifndef CRYPTO_OPERATIONS_H
#define CRYPTO_OPERATIONS_H

#include <vector>
#include <openssl/ec.h>

class CryptoOperations {
public:
    static std::vector<unsigned char> ECDH(
        const EC_KEY* privateKey, 
        const EC_KEY* publicKey
    );
    static std::vector<unsigned char> calculateSignature(
        const std::vector<unsigned char>& message, 
        const EC_KEY* privateKey
    );
    static bool verifySignature(
        const std::vector<unsigned char>& message, 
        const std::vector<unsigned char>& signature, 
        const std::vector<unsigned char>& publicKey
    );
    static std::vector<unsigned char> serializePublicKey(const EC_KEY* publicKey);
    static EC_KEY* deserializePublicKey(const std::vector<unsigned char>& serialized);
    static EC_KEY* generateECKey();
};

#endif