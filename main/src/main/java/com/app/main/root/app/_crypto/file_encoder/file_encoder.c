#include "file_encoder.h"

int init(
    EncoderContext* ctx,
    const uint8_t* key,
    size_t keyLength,
    EncryptionAlgo algo
) {
    if(!ctx || !key || keyLength == 0) {
        return ENCODER_ERROR_INVALID_PARAM;
    }

    const EVP_CIPHER* cipher = getCipher(algo);
    int reqKeyLen = EVP_CIPHER_key_length(cipher);
    if(keyLength != (size_t)reqKeyLen) return ENCODER_ERROR_INVALID_PARAM;

    ctx->key = (uint8_t*)malloc(keyLength);
    if(!ctx->key) {
        return ENCODER_ERROR_MEMORY;
    }
    memcpy(ctx->key, key, keyLength);
    ctx->keyLength = keyLength;

    ctx->algo = algo;

    ctx->ivLength = getIVSize(algo);
    ctx->iv = (uint8_t*)malloc(ctx->ivLength);
    if(!ctx->iv) {
        free(ctx->key);
        return ENCODER_ERROR_MEMORY;
    }

    ctx->tagLength = getTagSize(algo);
    ctx->tag = (uint8_t*)malloc(ctx->tagLength);
    if(!ctx->tag) {
        free(ctx->key);
        free(ctx->iv);
        return ENCODER_ERROR_MEMORY;
    }

    return ENCODER_SUCCESS;
}

/**
 * Encrypt Data
 */
int encryptData(
    EncoderContext* ctx,
    const uint8_t* input,
    size_t inputLength,
    uint8_t* output,
    size_t* outputLength
) {
    if(!ctx || !input || !output || !outputLength) {
        return ENCODER_ERROR_INVALID_PARAM;
    }

    if(generateIV(ctx) != ENCODER_SUCCESS) {
        return ENCODER_ERROR_CRYPTO;
    }

    const EVP_CIPHER* cipher = getCipher(ctx->algo);
    EVP_CIPHER_CTX* encryptCtx = EVP_CIPHER_CTX_new();
    if(!encryptCtx) return ENCODER_ERROR_MEMORY;

    if(EVP_EncryptInit_ex(
        encryptCtx,
        cipher,
        NULL,
        ctx->key,
        ctx->iv
    ) != 1) {
        EVP_CIPHER_CTX_free(encryptCtx);
        return ENCODER_ERROR_CRYPTO;
    }

    memcpy(output, ctx->iv, ctx->ivLength);
    
    int outLen = 0;
    if(EVP_EncryptUpdate(
        encryptCtx,
        output + ctx->ivLength,
        &outLen,
        input,
        inputLength
    ) != 1) {
        EVP_CIPHER_CTX_free(encryptCtx);
        return ENCODER_ERROR_CRYPTO;
    }
    *outputLength = ctx->ivLength + outLen;

    int finalLen = 0;
    if(EVP_EncryptFinal_ex(
        encryptCtx,
        output + *outputLength, 
        &finalLen
    ) != 1) {
        EVP_CIPHER_CTX_free(encryptCtx);
        return ENCODER_ERROR_CRYPTO;
    }
    *outputLength += finalLen;

    if(EVP_CIPHER_CTX_ctrl(
        encryptCtx,
        EVP_CTRL_GCM_GET_TAG,
        ctx->tagLength,
        ctx->tag
    ) != 1) {
        EVP_CIPHER_CTX_free(encryptCtx);
        return ENCODER_ERROR_CRYPTO;
    }

    memcpy(output + *outputLength, ctx->tag, ctx->tagLength);
    *outputLength += ctx->tagLength;

    EVP_CIPHER_CTX_free(encryptCtx);
    return ENCODER_SUCCESS;
}

/**
 * Decrypt Data
 */
int decryptData(
    EncoderContext* ctx,
    const uint8_t* input,
    size_t inputLength,
    uint8_t* output,
    size_t* outputLength
) {
    if(!ctx || !input || !output || !outputLength) {
        printf("Invalid parameters in decryptData\n");
        return ENCODER_ERROR_INVALID_PARAM;
    }
    
    if(inputLength < ctx->ivLength + ctx->tagLength + 1) {
        printf("ERROR: Input too short. Got %zu bytes, need at least %zu bytes\n", 
            inputLength, ctx->ivLength + ctx->tagLength + 1);
        return ENCODER_ERROR_INVALID_PARAM;
    }

    const uint8_t* iv = input;
    const uint8_t* encryptedData = input + ctx->ivLength;
    size_t encryptedDataLength = inputLength - ctx->ivLength - ctx->tagLength;
    const uint8_t* tag = encryptedData + encryptedDataLength;
    
    if(encryptedDataLength <= 0) {
        printf("Invalid encrypted data length: %zu\n", encryptedDataLength);
        return ENCODER_ERROR_INVALID_PARAM;
    }
    
    memcpy(ctx->iv, iv, ctx->ivLength);

    const EVP_CIPHER* cipher = getCipher(ctx->algo);
    if(!cipher) {
        printf("Failed to get cipher for algorithm: %d\n", ctx->algo);
        return ENCODER_ERROR_CRYPTO;
    }

    EVP_CIPHER_CTX* decryptCtx = EVP_CIPHER_CTX_new();
    if(!decryptCtx) {
        printf("Failed to create decryption context\n");
        return ENCODER_ERROR_MEMORY;
    }

    if(EVP_DecryptInit_ex(
        decryptCtx,
        cipher,
        NULL,
        ctx->key,
        ctx->iv
    ) != 1) {
        printf("Failed to initialize decryption\n");
        EVP_CIPHER_CTX_free(decryptCtx);
        return ENCODER_ERROR_CRYPTO;
    }

    if(EVP_CIPHER_CTX_ctrl(
        decryptCtx,
        EVP_CTRL_GCM_SET_TAG,
        ctx->tagLength,
        (void*)tag
    ) != 1) {
        printf("Failed to set authentication tag\n");
        EVP_CIPHER_CTX_free(decryptCtx);
        return ENCODER_ERROR_CRYPTO;
    }

    int outLen = 0;
    
    if(EVP_DecryptUpdate(
        decryptCtx,
        output,
        &outLen,
        encryptedData,
        encryptedDataLength
    ) != 1) {
        printf("Failed to process ciphertext\n");
        EVP_CIPHER_CTX_free(decryptCtx);
        return ENCODER_ERROR_CRYPTO;
    }
    *outputLength = outLen;

    int finalLen = 0;
    
    if(EVP_DecryptFinal_ex(
        decryptCtx,
        output + outLen,
        &finalLen
    ) != 1) {
        printf("Failed to finalize decryption - authentication failed\n");
        EVP_CIPHER_CTX_free(decryptCtx);
        return ENCODER_ERROR_CRYPTO;
    }

    *outputLength += finalLen;
    
    EVP_CIPHER_CTX_free(decryptCtx);
    /*
    printf("Decryption successful: inputLen=%zu, ivLen=%zu, tagLen=%zu, encryptedLen=%zu, outputLen=%zu\n", 
       inputLength, ctx->ivLength, ctx->tagLength, encryptedDataLength, *outputLength);
    */
    return ENCODER_SUCCESS;
}

/**
 * Encrypt File
 */
int encryptFile(
    const char* inputPath,
    const char* outputPath,
    EncoderContext* ctx
) {
    if(!inputPath || !outputPath || !ctx) {
        return ENCODER_ERROR_INVALID_PARAM;
    }

    FILE* inputFile = fopen(inputPath, "rb");
    if(!inputFile) return ENCODER_ERROR_IO;

    FILE* outputFile = fopen(outputPath, "wb");
    if(!outputFile) {
        fclose(inputFile);
        return ENCODER_ERROR_IO;
    }

    if(generateIV(ctx) != ENCODER_SUCCESS) {
        fclose(inputFile);
        fclose(outputFile);
        return ENCODER_ERROR_CRYPTO;
    }

    const EVP_CIPHER* cipher = getCipher(ctx->algo);
    EVP_CIPHER_CTX* encryptCtx = EVP_CIPHER_CTX_new();
    if(!encryptCtx) {
        fclose(inputFile);
        fclose(outputFile);
        return ENCODER_ERROR_MEMORY;
    }

    if(EVP_EncryptInit_ex(encryptCtx, cipher, NULL, ctx->key, ctx->iv) != 1) {
        EVP_CIPHER_CTX_free(encryptCtx);
        fclose(inputFile);
        fclose(outputFile);
        return ENCODER_ERROR_CRYPTO;
    }

    FileHeader header;
    memset(&header, 0, sizeof(FileHeader));
    fseek(inputFile, 0, SEEK_END);
    header.fileSize = ftell(inputFile);
    fseek(inputFile, 0, SEEK_SET);
    header.algo = ctx->algo;
    header.timestamp = (uint64_t)time(NULL);
    memcpy(header.iv, ctx->iv, ctx->ivLength);

    if(fwrite(&header, sizeof(FileHeader), 1, outputFile) != 1) {
        EVP_CIPHER_CTX_free(encryptCtx);
        fclose(inputFile);
        fclose(outputFile);
        return ENCODER_ERROR_IO;
    }

    const size_t CHUNK_SIZE = 4096;
    uint8_t* buffer = (uint8_t*)malloc(CHUNK_SIZE);
    uint8_t* encryptedBuffer = (uint8_t*)malloc(CHUNK_SIZE + 32);
    
    if(!buffer || !encryptedBuffer) {
        if(buffer) free(buffer);
        if(encryptedBuffer) free(encryptedBuffer);
        EVP_CIPHER_CTX_free(encryptCtx);
        fclose(inputFile);
        fclose(outputFile);
        return ENCODER_ERROR_MEMORY;
    }
    
    size_t totalEncrypted = 0;

    while(!feof(inputFile)) {
        size_t bytesRead = fread(buffer, 1, CHUNK_SIZE, inputFile);
        if(bytesRead > 0) {
            int outLen = 0;
            
            if(EVP_EncryptUpdate(encryptCtx, encryptedBuffer, &outLen, buffer, bytesRead) != 1) {
                free(buffer);
                free(encryptedBuffer);
                EVP_CIPHER_CTX_free(encryptCtx);
                fclose(inputFile);
                fclose(outputFile);
                return ENCODER_ERROR_CRYPTO;
            }
            
            if(fwrite(encryptedBuffer, 1, outLen, outputFile) != (size_t)outLen) {
                free(buffer);
                free(encryptedBuffer);
                EVP_CIPHER_CTX_free(encryptCtx);
                fclose(inputFile);
                fclose(outputFile);
                return ENCODER_ERROR_IO;
            }
            totalEncrypted += outLen;
        }
    }

    int finalLen = 0;
    if(EVP_EncryptFinal_ex(encryptCtx, encryptedBuffer, &finalLen) != 1) {
        free(buffer);
        free(encryptedBuffer);
        EVP_CIPHER_CTX_free(encryptCtx);
        fclose(inputFile);
        fclose(outputFile);
        return ENCODER_ERROR_CRYPTO;
    }
    
    if(finalLen > 0) {
        if(fwrite(encryptedBuffer, 1, finalLen, outputFile) != (size_t)finalLen) {
            free(buffer);
            free(encryptedBuffer);
            EVP_CIPHER_CTX_free(encryptCtx);
            fclose(inputFile);
            fclose(outputFile);
            return ENCODER_ERROR_IO;
        }
        totalEncrypted += finalLen;
    }

    if(EVP_CIPHER_CTX_ctrl(encryptCtx, EVP_CTRL_GCM_GET_TAG, ctx->tagLength, ctx->tag) != 1) {
        free(buffer);
        free(encryptedBuffer);
        EVP_CIPHER_CTX_free(encryptCtx);
        fclose(inputFile);
        fclose(outputFile);
        return ENCODER_ERROR_CRYPTO;
    }

    if(fwrite(ctx->tag, 1, ctx->tagLength, outputFile) != ctx->tagLength) {
        free(buffer);
        free(encryptedBuffer);
        EVP_CIPHER_CTX_free(encryptCtx);
        fclose(inputFile);
        fclose(outputFile);
        return ENCODER_ERROR_IO;
    }
    totalEncrypted += ctx->tagLength;

    free(buffer);
    free(encryptedBuffer);
    EVP_CIPHER_CTX_free(encryptCtx);

    header.encryptedSize = totalEncrypted;
    memcpy(header.tag, ctx->tag, ctx->tagLength);
    fseek(outputFile, 0, SEEK_SET);
    if(fwrite(&header, sizeof(FileHeader), 1, outputFile) != 1) {
        fclose(inputFile);
        fclose(outputFile);
        return ENCODER_ERROR_IO;
    }

    fclose(inputFile);
    fclose(outputFile);
    
    printf("File encryption successful:\n");
    printf("  Original size: %llu bytes\n", (unsigned long long)header.fileSize);
    printf("  Encrypted size: %zu bytes\n", totalEncrypted);
    printf("  IV: "); 
    for(size_t i = 0; i < ctx->ivLength && i < 12; i++) printf("%02x", ctx->iv[i]); 
    printf("\n");
    printf("  Tag: "); 
    for(size_t i = 0; i < ctx->tagLength && i < 16; i++) printf("%02x", ctx->tag[i]); 
    printf("\n");
    
    return ENCODER_SUCCESS;
}

/**
 * Decrypt File
 */
int decryptFile(
    const char* inputPath,
    const char* outputPath,
    EncoderContext* ctx
) {
    if(!inputPath || !outputPath || !ctx) {
        return ENCODER_ERROR_INVALID_PARAM;
    }

    FILE* inputFile = fopen(inputPath, "rb");
    if(!inputFile) return ENCODER_ERROR_IO;

    FILE* outputFile = fopen(outputPath, "wb");
    if(!outputFile) {
        fclose(inputFile);
        return ENCODER_ERROR_IO;
    }

    FileHeader header;
    if(fread(&header, sizeof(FileHeader), 1, inputFile) != 1) {
        fclose(inputFile);
        fclose(outputFile);
        return ENCODER_ERROR_IO;
    }

    ctx->algo = header.algo;
    memcpy(ctx->iv, header.iv, ctx->ivLength);
    memcpy(ctx->tag, header.tag, ctx->tagLength);

    printf("File decryption starting:\n");
    printf("  Expected original size: %llu bytes\n", (unsigned long long)header.fileSize);
    printf("  Encrypted size: %zu bytes\n", header.encryptedSize);
    printf("  IV: "); 
    for(size_t i = 0; i < ctx->ivLength && i < 12; i++) printf("%02x", ctx->iv[i]); 
    printf("\n");
    printf("  Tag: "); 
    for(size_t i = 0; i < ctx->tagLength && i < 16; i++) printf("%02x", ctx->tag[i]); 
    printf("\n");

    const EVP_CIPHER* cipher = getCipher(ctx->algo);
    EVP_CIPHER_CTX* decryptCtx = EVP_CIPHER_CTX_new();
    if(!decryptCtx) {
        fclose(inputFile);
        fclose(outputFile);
        return ENCODER_ERROR_MEMORY;
    }

    if(EVP_DecryptInit_ex(decryptCtx, cipher, NULL, ctx->key, ctx->iv) != 1) {
        printf("Failed to initialize decryption\n");
        EVP_CIPHER_CTX_free(decryptCtx);
        fclose(inputFile);
        fclose(outputFile);
        return ENCODER_ERROR_CRYPTO;
    }

    if(EVP_CIPHER_CTX_ctrl(decryptCtx, EVP_CTRL_GCM_SET_TAG, ctx->tagLength, ctx->tag) != 1) {
        printf("Failed to set authentication tag\n");
        EVP_CIPHER_CTX_free(decryptCtx);
        fclose(inputFile);
        fclose(outputFile);
        return ENCODER_ERROR_CRYPTO;
    }

    const size_t CHUNK_SIZE = 4096;
    uint8_t* buffer = (uint8_t*)malloc(CHUNK_SIZE);
    uint8_t* decryptedBuffer = (uint8_t*)malloc(CHUNK_SIZE);
    
    if(!buffer || !decryptedBuffer) {
        if(buffer) free(buffer);
        if(decryptedBuffer) free(decryptedBuffer);
        EVP_CIPHER_CTX_free(decryptCtx);
        fclose(inputFile);
        fclose(outputFile);
        return ENCODER_ERROR_MEMORY;
    }

    size_t totalDecrypted = 0;
    size_t remaining = header.encryptedSize - ctx->tagLength;
    
    while(remaining > 0) {
        size_t toRead = remaining < CHUNK_SIZE ? remaining : CHUNK_SIZE;
        size_t bytesRead = fread(buffer, 1, toRead, inputFile);
        if(bytesRead > 0) {
            int outLen = 0;
            
            if(EVP_DecryptUpdate(decryptCtx, decryptedBuffer, &outLen, buffer, bytesRead) != 1) {
                printf("Failed during DecryptUpdate\n");
                free(buffer);
                free(decryptedBuffer);
                EVP_CIPHER_CTX_free(decryptCtx);
                fclose(inputFile);
                fclose(outputFile);
                return ENCODER_ERROR_CRYPTO;
            }
            
            if(fwrite(decryptedBuffer, 1, outLen, outputFile) != (size_t)outLen) {
                free(buffer);
                free(decryptedBuffer);
                EVP_CIPHER_CTX_free(decryptCtx);
                fclose(inputFile);
                fclose(outputFile);
                return ENCODER_ERROR_IO;
            }

            totalDecrypted += outLen;
            remaining -= bytesRead;
        } else {
            break;
        }
    }

    int finalLen = 0;
    if(EVP_DecryptFinal_ex(decryptCtx, decryptedBuffer, &finalLen) != 1) {
        printf("Failed to finalize decryption - authentication failed\n");
        printf("  This means either:\n");
        printf("    - Wrong key was used\n");
        printf("    - Data was tampered with\n");
        printf("    - IV/Tag mismatch\n");
        free(buffer);
        free(decryptedBuffer);
        EVP_CIPHER_CTX_free(decryptCtx);
        fclose(inputFile);
        fclose(outputFile);
        return ENCODER_ERROR_CRYPTO;
    }

    if(finalLen > 0) {
        if(fwrite(decryptedBuffer, 1, finalLen, outputFile) != (size_t)finalLen) {
            free(buffer);
            free(decryptedBuffer);
            EVP_CIPHER_CTX_free(decryptCtx);
            fclose(inputFile);
            fclose(outputFile);
            return ENCODER_ERROR_IO;
        }
        totalDecrypted += finalLen;
    }

    free(buffer);
    free(decryptedBuffer);
    EVP_CIPHER_CTX_free(decryptCtx);

    //printf("File decryption successful: %zu bytes decrypted\n", totalDecrypted);

    if(totalDecrypted != header.fileSize) {
        printf("WARNING: Size mismatch! Expected %llu, got %zu\n", 
               (unsigned long long)header.fileSize, totalDecrypted);
        fclose(inputFile);
        fclose(outputFile);
        return ENCODER_ERROR_CRYPTO;
    }

    fclose(inputFile);
    fclose(outputFile);
    return ENCODER_SUCCESS;
}

size_t getEncryptedSize(size_t inputLen, EncryptionAlgo algo) {
    return inputLen + getTagSize(algo) + 16;
}

size_t getOverhead(EncryptionAlgo algo) {
    return getTagSize(algo) + 16;
}

int deriveKey(
    const char* password,
    const uint8_t* salt,
    size_t saltLength,
    uint8_t* key,
    size_t keyLength
) {
    if(!password || !salt || !key || keyLength == 0) {
        return ENCODER_ERROR_INVALID_PARAM;
    }

    if(PKCS5_PBKDF2_HMAC(
        password, strlen(password),
        salt,
        saltLength,
        100000,
        EVP_sha256(),
        keyLength,
        key
    ) != 1) {
        return ENCODER_ERROR_CRYPTO;
    }

    return ENCODER_SUCCESS;
}

void cleanup(EncoderContext* ctx) {
    if(ctx) {
        if(ctx->key) {
            memset(ctx->key, 0, ctx->keyLength);
            free(ctx->key);
        }
        if(ctx->iv) {
            free(ctx->iv);
        }
        if(ctx->tag) {
            free(ctx->tag);
        }

        ctx->key = NULL;
        ctx->iv = NULL;
        ctx->tag = NULL;
        ctx->keyLength = 0;
        ctx->ivLength = 0;
        ctx->tagLength = 0;
    }
}