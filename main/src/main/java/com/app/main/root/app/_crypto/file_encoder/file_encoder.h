#pragma once
#include <stddef.h>
#include <stdint.h>

#ifdef __cplusplus
extern "C" {
#endif

#include "context.h"
#include "iv/iv.h"
#include "cipher/cipher.h"

int init(
    EncoderContext* ctx,
    const uint8_t* key,
    size_t keyLength,
    EncryptionAlgo algo
);

int encryptData(
    EncoderContext* ctx,
    const uint8_t* input,
    size_t inputLength,
    uint8_t* output,
    size_t* outputLength
);
int decryptData(
    EncoderContext* ctx,
    const uint8_t* input,
    size_t inputLength,
    uint8_t* output,
    size_t* outputLength
);

int encryptFile(
    const char* inputPath,
    const char* outputPath,
    EncoderContext* ctx
);
int decryptFile(
    const char* inputPath,
    const char* outputPath,
    EncoderContext* ctx
);

size_t getEncryptedSize(size_t inputLength, EncryptionAlgo algo);
size_t getOverhead(EncryptionAlgo algo);
int deriveKey(
    const char* password,
    const uint8_t* salt,
    size_t saltLength,
    uint8_t* key,
    size_t keyLength
);

void cleanup(EncoderContext* ctx);

#ifdef __cplusplus
}
#endif