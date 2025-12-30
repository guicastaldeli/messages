#pragma once
#include <stddef.h>
#include <stdint.h>
#include <openssl/evp.h>
#include <openssl/rand.h>
#include <openssl/err.h>
#include <openssl/kdf.h>

typedef enum {
    ALGO_AES_256_GCM = 0,
    ALGO_CHACHA20_POLY1305 = 1,
    ALGO_XCHACHA20_POLY1305 = 2
} EncryptionAlgo;

typedef struct {
    uint8_t* key;
    size_t keyLength;
    EncryptionAlgo algo;
    uint8_t* iv;
    size_t ivLength;
    uint8_t* tag;
    size_t tagLength;
} EncoderContext;

typedef struct {
    uint64_t fileSize;
    uint64_t encryptedSize;
    uint32_t algo;
    uint64_t timestamp;
    uint8_t iv[64];
    uint8_t tag[16];
    uint8_t reserved[32];
} FileHeader;

#define ENCODER_SUCCESS 0
#define ENCODER_ERROR_INVALID_PARAM -1
#define ENCODER_ERROR_MEMORY -2
#define ENCODER_ERROR_IO -3
#define ENCODER_ERROR_CRYPTO -4
#define ENCODER_ERROR_INVALID_STATE -5