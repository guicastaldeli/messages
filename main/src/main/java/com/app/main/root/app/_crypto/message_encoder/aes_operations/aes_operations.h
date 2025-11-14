#ifndef AES_OPERATIONS_H
#define AES_OPERATIONS_H

#include <vector>

class AESOperations {
private:
    static const int KEY_LENGTH = 32;
    static const int IV_LENGTH = 12;
    static const int AUTH_TAG_LENGTH = 16;

public:
    static std::vector<unsigned char> aesGcmEncrypt(
        const std::vector<unsigned char>& plainText,
        const std::vector<unsigned char>& key,
        const std::vector<unsigned char>& iv,
        const std::vector<unsigned char>& aad
    );
    
    static std::vector<unsigned char> aesGcmDecrypt(
        const std::vector<unsigned char>& cipherText,
        const std::vector<unsigned char>& key,
        const std::vector<unsigned char>& iv,
        const std::vector<unsigned char>& aad
    );
    
    static std::vector<unsigned char> generateRandomIV();
};

#endif