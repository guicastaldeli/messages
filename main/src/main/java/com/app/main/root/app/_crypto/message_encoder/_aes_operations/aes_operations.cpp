#include "aes_operations.h"
#include <openssl/evp.h>
#include <openssl/rand.h>
#include <stdexcept>
#include <iostream>
#include <string>
#include <sstream>

template<typename T>
std::string toString(T value) {
    std::ostringstream os;
    os << value;
    return os.str();
}

std::vector<unsigned char> AESOperations::generateRandomIV() {
    std::vector<unsigned char> iv(IV_LENGTH);
    if(RAND_bytes(iv.data(), iv.size()) != 1) {
        throw std::runtime_error("Failed to generate random IV");
    }
    return iv;
}

std::vector<unsigned char> AESOperations::aesGcmEncrypt(
    const std::vector<unsigned char>& plainText,
    const std::vector<unsigned char>& key,
    const std::vector<unsigned char>& iv,
    const std::vector<unsigned char>& aad
) {
    if(key.size() != KEY_LENGTH) throw std::runtime_error("invalid key length: " + toString(key.size()));
    if(iv.size() != IV_LENGTH) throw std::runtime_error("invalid iv length: " + toString(iv.size()));

    EVP_CIPHER_CTX* ctx = EVP_CIPHER_CTX_new();
    if(!ctx) throw std::runtime_error("failed to create cipher ctx");

    try {
        std::vector<unsigned char> cipherText(plainText.size() + EVP_MAX_BLOCK_LENGTH);
        int len = 0;
        int cipherTextLen = 0;
    
        if(!EVP_EncryptInit_ex(ctx, EVP_aes_256_gcm(), nullptr, nullptr, nullptr)) {
            throw std::runtime_error("failed to initialize AES-GCM encryption");
        }
        if(!EVP_CIPHER_CTX_ctrl(ctx, EVP_CTRL_GCM_SET_IVLEN, iv.size(), nullptr)) {
            throw std::runtime_error("failed to set IV length");
        }
        if(!EVP_EncryptInit_ex(ctx, nullptr, nullptr, key.data(), iv.data())) {
            throw std::runtime_error("failed to set key and IV");
        }
        if(!aad.empty()) {
            if(!EVP_EncryptUpdate(ctx, nullptr, &len, aad.data(), aad.size())) {
                throw std::runtime_error("failed to process AAD");
            }
        }

        if(!EVP_EncryptUpdate(ctx, cipherText.data(), &len, plainText.data(), plainText.size())) {
            throw std::runtime_error("failed to encrypt data");
        }
        cipherTextLen = len;
        
        if(!EVP_EncryptFinal_ex(ctx, cipherText.data() + len, &len)) {
            throw std::runtime_error("failed to finalize encryption");
        }
        cipherTextLen += len;
        cipherText.resize(cipherTextLen);
        
        std::vector<unsigned char> tag(AUTH_TAG_LENGTH);
        if(!EVP_CIPHER_CTX_ctrl(ctx, EVP_CTRL_GCM_GET_TAG, tag.size(), tag.data())) {
            throw std::runtime_error("failed to get authentication tag");
        }
        
        std::vector<unsigned char> result;
        result.reserve(iv.size() + cipherText.size() + tag.size());
        result.insert(result.end(), iv.begin(), iv.end());
        result.insert(result.end(), cipherText.begin(), cipherText.end());
        result.insert(result.end(), tag.begin(), tag.end());
        
        EVP_CIPHER_CTX_free(ctx);
        return result;
    } catch(...) {
        EVP_CIPHER_CTX_free(ctx);
        throw;
    }
}

std::vector<unsigned char> AESOperations::aesGcmDecrypt(
    const std::vector<unsigned char>& encryptedData,
    const std::vector<unsigned char>& key,
    const std::vector<unsigned char>& aad
) {
    if(key.size() != KEY_LENGTH) throw std::runtime_error("invalid key length: " + toString(key.size()));
    if(encryptedData.size() < IV_LENGTH + AUTH_TAG_LENGTH) {
        throw std::runtime_error("encrypted data too short");
    }

    std::vector<unsigned char> iv(
        encryptedData.begin(), 
        encryptedData.begin() + IV_LENGTH
    );
    std::vector<unsigned char> cipherText(
        encryptedData.begin() + IV_LENGTH, 
        encryptedData.end() - AUTH_TAG_LENGTH
    );
    std::vector<unsigned char> tag(
        encryptedData.end() - AUTH_TAG_LENGTH, 
        encryptedData.end()
    );

    EVP_CIPHER_CTX* ctx = EVP_CIPHER_CTX_new();
    if(!ctx) throw std::runtime_error("failed to create cipher ctx");

    try {
        std::vector<unsigned char> plainText(cipherText.size() + EVP_MAX_BLOCK_LENGTH);
        int len = 0;
        int plainTextLen = 0;
    
        if(!EVP_DecryptInit_ex(ctx, EVP_aes_256_gcm(), nullptr, nullptr, nullptr)) {
            throw std::runtime_error("failed to initialize AES-GCM decryption");
        }
        if(!EVP_CIPHER_CTX_ctrl(ctx, EVP_CTRL_GCM_SET_IVLEN, iv.size(), nullptr)) {
            throw std::runtime_error("failed to set IV length");
        }
        if(!EVP_DecryptInit_ex(ctx, nullptr, nullptr, key.data(), iv.data())) {
            throw std::runtime_error("failed to set key and IV");
        }
        if(!aad.empty()) {
            if(!EVP_DecryptUpdate(ctx, nullptr, &len, aad.data(), aad.size())) {
                throw std::runtime_error("failed to process AAD");
            }
        }
        
        if(!EVP_DecryptUpdate(ctx, plainText.data(), &len, cipherText.data(), cipherText.size())) {
            throw std::runtime_error("failed to decrypt data");
        }
        plainTextLen = len;

        if(!EVP_CIPHER_CTX_ctrl(ctx, EVP_CTRL_GCM_SET_TAG, tag.size(), tag.data())) {
            throw std::runtime_error("failed to set authentication tag");
        }
    
        int ret = EVP_DecryptFinal_ex(ctx, plainText.data() + len, &len);
        if(ret > 0) {
            plainTextLen += len;
            plainText.resize(plainTextLen);
            EVP_CIPHER_CTX_free(ctx);
            return plainText;
        } else {
            throw std::runtime_error("Decryption failed: authentication tag mismatch");
        }
    } catch(...) {
        EVP_CIPHER_CTX_free(ctx);
        throw;
    }
}