#include "crypto_operations.h"
#include <openssl/ecdsa.h>
#include <openssl/obj_mac.h>
#include <stdexcept>

std::vector<unsigned char> CryptoOperations::ECDH(const EC_KEY* privateKey, const EC_KEY* publicKey) {
    const EC_POINT* publicPoint = EC_KEY_get0_public_key(publicKey);
    size_t fieldSize = EC_GROUP_get_degree(EC_KEY_get0_group(privateKey));
    size_t secretLen = (fieldSize + 7) / 8;

    std::vector<unsigned char> secret(secretLen);
    ECDH_compute_key(
        secret.data(),
        secretLen,
        publicPoint,
        privateKey,
        nullptr
    );

    return secret;
}

std::vector<unsigned char> CryptoOperations::calculateSignature(
    const std::vector<unsigned char>& message,
    const EC_KEY* privateKey
) {
    std::vector<unsigned char> signature(ECDSA_size(privateKey));
    unsigned int signatureLen = 0;
    
    ECDSA_sign(
        0, 
        message.data(), 
        message.size(), 
        signature.data(), 
        &signatureLen, 
        const_cast<EC_KEY*>(privateKey)
    );
    signature.resize(signatureLen);
    return signature;
}

bool CryptoOperations::verifySignature(
    const std::vector<unsigned char>& message,
    const std::vector<unsigned char>& signature,
    const std::vector<unsigned char>& publicKey
) {
    EC_KEY* pubKey = deserializePublicKey(publicKey);
    if(!pubKey) return false;
    
    int result = ECDSA_verify(
        0, 
        message.data(), 
        message.size(), 
        signature.data(), 
        signature.size(), 
        pubKey
    );
    EC_KEY_free(pubKey);
    return result == 1;
}

std::vector<unsigned char> CryptoOperations::serializePublicKey(const EC_KEY* publicKey) {
    const EC_POINT* point = EC_KEY_get0_public_key(publicKey);
    const EC_GROUP* group = EC_KEY_get0_group(publicKey);

    point_conversion_form_t form = POINT_CONVERSION_COMPRESSED;
    size_t len = EC_POINT_point2oct(group, point, form, nullptr, 0, nullptr);

    std::vector<unsigned char> serialized(len);
    EC_POINT_point2oct(group, point, form, serialized.data(), len, nullptr);
    return serialized;
}

EC_KEY* CryptoOperations::deserializePublicKey(const std::vector<unsigned char>& serialized) {
    EC_KEY* key = EC_KEY_new_by_curve_name(NID_X9_62_prime256v1);
    const EC_GROUP* group = EC_KEY_get0_group(key);
    
    EC_POINT* point = EC_POINT_new(group);
    if(EC_POINT_oct2point(group, point, serialized.data(), serialized.size(), nullptr)) {
        EC_KEY_set_public_key(key, point);
    }

    EC_POINT_free(point);
    return key;
}

EC_KEY* CryptoOperations::generateECKey() {
    EC_KEY* key = EC_KEY_new_by_curve_name(NID_X9_62_prime256v1);
    EC_KEY_generate_key(key);
    return key;
}