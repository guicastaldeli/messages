#include "iv.h"

/**
 * Get Size
 */
size_t getIVSize(EncryptionAlgo algo) {
    switch(algo) {
        case ALGO_AES_256_GCM:
            return 12;
        case ALGO_CHACHA20_POLY1305:
            return 12;
        case ALGO_XCHACHA20_POLY1305:
            return 24;
        default:
            return 12;
    }
}

/**
 * Generate
 */
int generateIV(EncoderContext* ctx) {
    if(!ctx || !ctx->iv) {
        return ENCODER_ERROR_INVALID_PARAM;
    }
    if(RAND_bytes(ctx->iv, ctx->ivLength) != 1) {
        return ENCODER_ERROR_CRYPTO;
    }
    return ENCODER_SUCCESS;
}