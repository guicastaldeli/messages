#ifndef AES_OPERATIONS_H
#define AES_OPERATIONS_H

#include <vector>

class AESOperations {
private:

public:
    static const int KEY_LENGTH = 32;
    static const int IV_LENGTH = 12;
    static const int AUTH_TAG_LENGTH = 16;
    static const int ENCRYPTED_MESSAGE_OVERHEAD = IV_LENGTH + AUTH_TAG_LENGTH;
    static std::vector<unsigned char> aesGcmEncrypt(
        const std::vector<unsigned char>& plainText,
        const std::vector<unsigned char>& key,
        const std::vector<unsigned char>& iv,
        const std::vector<unsigned char>& aad
    );
    
    static std::vector<unsigned char> aesGcmDecrypt(
        const std::vector<unsigned char>& encryptedData,
        const std::vector<unsigned char>& key,
        const std::vector<unsigned char>& aad
    );
    
    static std::vector<unsigned char> generateRandomIV();
};

#endif