#include "cipher.h"

/**
 * Get Cipher
 */
const EVP_CIPHER* getCipher(EncryptionAlgo algo) {
    switch(algo) {
        case ALGO_AES_256_GCM:
            return EVP_aes_256_gcm();
        case ALGO_CHACHA20_POLY1305:
            return EVP_chacha20_poly1305();
        case ALGO_XCHACHA20_POLY1305:
            #ifdef EVP_CHACHA20
                return EVP_chacha20_poly1305();
            #else 
                return EVP_chacha20_poly1305();
            #endif
        default:
            return EVP_aes_256_gcm();
    }
}

/**
 * Get Tag Size
 */
size_t getTagSize(EncryptionAlgo algo) {
    return 16;
}