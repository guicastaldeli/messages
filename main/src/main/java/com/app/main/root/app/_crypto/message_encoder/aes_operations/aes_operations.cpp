#include "aes_operations.h"
#include <openssl/evp.h>
#include <openssl/rand.h>
#include <stdexcept>

std::vector<unsigned char> AESOperations::aesGcmEncrypt(
    const std::vector<unsigned char>& plainText,
    const std::vector<unsigned char>& key,
    const std::vector<unsigned char>& iv,
    const std::vector<unsigned char>& aad
) {
    EVP_CIPHER_CTX* ctx = EVP_CIPHER_CTX_new();
    std::vector<unsigned char> cipherText(plainText.size() + AUTH_TAG_LENGTH);
    int len = 0;
    int cipherTextLen = 0;

    EVP_EncryptInit_ex(ctx, EVP_aes_256_gcm(), nullptr, nullptr, nullptr);
    EVP_CIPHER_CTX_ctrl(ctx, EVP_CTRL_GCM_SET_IVLEN, iv.size(), nullptr);
    EVP_EncryptInit_ex(ctx, nullptr, nullptr, key.data(), iv.data());

    if(!aad.empty()) EVP_EncryptUpdate(ctx, nullptr, &len, aad.data(), aad.size());
    EVP_EncryptUpdate(ctx, cipherText.data(), &len, plainText.data(), plainText.size());
    cipherTextLen = len;
    EVP_EncryptFinal_ex(ctx, cipherText.data() + len, &len);
    cipherTextLen += len;

    EVP_CIPHER_CTX_ctrl(
        ctx,
        EVP_CTRL_GCM_GET_TAG, 
        AUTH_TAG_LENGTH,
        cipherText.data() + plainText.size()
    );
    EVP_CIPHER_CTX_free(ctx);

    cipherText.resize(cipherTextLen + AUTH_TAG_LENGTH);
    return cipherText;
}

std::vector<unsigned char> AESOperations::aesGcmDecrypt(
    const std::vector<unsigned char>& cipherText,
    const std::vector<unsigned char>& key,
    const std::vector<unsigned char>& iv,
    const std::vector<unsigned char>& aad
) {
    if(cipherText.size() < AUTH_TAG_LENGTH) {
        throw std::runtime_error("ciphertext too short!");
    }

    size_t dataLen = cipherText.size() - AUTH_TAG_LENGTH;
    EVP_CIPHER_CTX* ctx = EVP_CIPHER_CTX_new();
    std::vector<unsigned char> plainText(dataLen);
    int len = 0;
    int plainTextLen = 0;

    EVP_DecryptInit_ex(ctx, EVP_aes_256_gcm(), nullptr, nullptr, nullptr);
    EVP_CIPHER_CTX_ctrl(ctx, EVP_CTRL_GCM_SET_IVLEN, iv.size(), nullptr);
    EVP_DecryptInit_ex(ctx, nullptr, nullptr, key.data(), iv.data());

    if(!aad.empty()) EVP_DecryptUpdate(ctx, nullptr, &len, aad.data(), aad.size());
    EVP_DecryptUpdate(ctx, plainText.data(), &len, cipherText.data(), dataLen);
    plainTextLen = len;
    EVP_CIPHER_CTX_ctrl(
        ctx,
        EVP_CTRL_GCM_SET_TAG, 
        AUTH_TAG_LENGTH,
        const_cast<unsigned char*>(cipherText.data() + dataLen)
    );

    int ret = EVP_DecryptFinal_ex(ctx, plainText.data() + len, &len);
    plainTextLen += len;
    EVP_CIPHER_CTX_free(ctx);
    if(ret > 0) {
        plainText.resize(plainTextLen);
        return plainText;
    } else {
        throw std::runtime_error("Decryption failed, authentication tag mismatch");
    }
}

std::vector<unsigned char> AESOperations::generateRandomIV() {
    std::vector<unsigned char> iv(IV_LENGTH);
    RAND_bytes(iv.data(), IV_LENGTH);
    return iv;
}