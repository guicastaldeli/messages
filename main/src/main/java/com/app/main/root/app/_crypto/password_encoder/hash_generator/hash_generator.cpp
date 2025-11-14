#include "hash_generator.h"
#include <openssl/evp.h>
#include <openssl/hmac.h>
#include <stdexcept>

std::vector<unsigned char> HashGenerator::generateSecureHash(
    const std::vector<unsigned char>& pepperedPassword,
    const std::vector<unsigned char>& salt
) {
    std::vector<unsigned char> key(HASH_KEY_LENGTH / 8);
    if(PKCS5_PBKDF2_HMAC(
       reinterpret_cast<const char*>(pepperedPassword.data()),
       static_cast<int>(pepperedPassword.size()),
       salt.data(),
       static_cast<int>(salt.size()),
       HASH_ITERATIONS,
       EVP_sha512(),
       static_cast<int>(key.size()),
       key.data()) != 1
    ) {
        throw std::runtime_error("PBKDF2 failed");
    }

    auto memoryHardResult = applyMemoryHardFunction(key, salt);
    return applyFinalHmac(memoryHardResult, salt);
}

std::vector<unsigned char> HashGenerator::applyMemoryHardFunction(
    const std::vector<unsigned char>& input,
    const std::vector<unsigned char>& salt
) {
    EVP_MD_CTX* ctx = nullptr;

    try {
        const size_t MEMORY_SIZE = 8192;
        std::vector<unsigned char> memoryBuffer(MEMORY_SIZE);
        std::vector<unsigned char> block(EVP_MAX_MD_SIZE);
        unsigned int blockLen = 0;

        ctx = EVP_MD_CTX_new();
        if(!ctx) throw std::runtime_error("EVP_MD_CTX_new failed");

        std::vector<unsigned char> combined(input.size() + salt.size());
        std::copy(input.begin(), input.end(), combined.begin());
        std::copy(salt.begin(), salt.end(), combined.begin() + input.size());
        
        EVP_DigestInit_ex(ctx, EVP_sha512(), nullptr);
        EVP_DigestUpdate(ctx, combined.data(), combined.size());
        EVP_DigestFinal_ex(ctx, block.data(), &blockLen);
        block.resize(blockLen);

        const int ITERATIONS = 1000;
        for(int i = 0; i < ITERATIONS; i++) {
            size_t pos = i % MEMORY_SIZE;
            size_t availableSpace = MEMORY_SIZE - pos;
            size_t copyLen = (std::min)(block.size(), availableSpace);
            std::copy(block.begin(), block.begin() + copyLen, memoryBuffer.begin() + pos);

            if(EVP_DigestInit_ex(ctx, EVP_sha512(), nullptr) != 1) {
                throw std::runtime_error("EVP_DigestInit_ex failed in loop");
            }
            if(EVP_DigestUpdate(ctx, block.data(), block.size()) != 1) {
                throw std::runtime_error("EVP_DigestUpdate failed in loop");
            }
            if(EVP_DigestFinal_ex(ctx, block.data(), &blockLen) != 1) {
                throw std::runtime_error("EVP_DigestFinal_ex failed in loop");
            }
            block.resize(blockLen);
        }

        std::vector<unsigned char> result(64);
        if(EVP_DigestInit_ex(ctx, EVP_sha512(), nullptr) != 1) {
            throw std::runtime_error("EVP_DigestInit_ex failed in final");
        }
        if(EVP_DigestUpdate(ctx, memoryBuffer.data(), memoryBuffer.size()) != 1) {
            throw std::runtime_error("EVP_DigestUpdate failed in final");
        }
        if(EVP_DigestFinal_ex(ctx, result.data(), &blockLen) != 1) {
            throw std::runtime_error("EVP_DigestFinal_ex failed in final");
        }
        result.resize(blockLen);
        EVP_MD_CTX_free(ctx);
        ctx = nullptr;

        return result;
    } catch(...) {
        if(ctx) EVP_MD_CTX_free(ctx);
        return input;
    }
}

std::vector<unsigned char> HashGenerator::applyFinalHmac(
    const std::vector<unsigned char>& input,
    const std::vector<unsigned char>& salt
) {
    std::vector<unsigned char> result(EVP_MAX_MD_SIZE);
    unsigned int resultLen = 0;

    const EVP_MD* md = EVP_sha512();
    HMAC(
        md,
        salt.data(),
        salt.size(),
        input.data(),
        input.size(),
        result.data(),
        &resultLen
    );
    result.resize(resultLen);
    return result;
}

bool HashGenerator::constantTimeEquals(
    const std::vector<unsigned char>& a,
    const std::vector<unsigned char>& b
) {
    if(a.size() != b.size()) return false;
    unsigned char result = 0;
    for(size_t i = 0; i < a.size(); i++) {
        result |= a[i] ^ b[i];
    } 
    return result == 0;
}