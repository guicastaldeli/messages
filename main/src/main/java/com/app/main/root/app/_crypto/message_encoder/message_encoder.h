#ifndef MESSAGE_ENCODER_H
#define MESSAGE_ENCODER_H

#include "session_keys.h"
#include "identity_key.h"
#include "pre_keys.h"
#include "crypto_operations.h"
#include "aes_operations.h"
#include "key_derivation.h"
#include "base64_manager.h"
#include <string>
#include <vector>

class MessageEncoder {
private:
    IdentityKeyManager identityManager;
    PreKeyManager preKeyManager;
    SessionManager sessionManager;

public:
    MessageEncoder();
    ~MessageEncoder();

    std::vector<unsigned char> getIdentityPublicKey();
    PreKeyBundle getPreKeyBundle();
    bool verifyAndStorePreKeyBundle(
        const PreKeyBundle& bundle, 
        const std::string& recipientId
    );
    bool initSession(
        const std::string& recipientId, 
        const PreKeyBundle& bundle
    );
    
    std::vector<unsigned char> encryptMessage(
        const std::string& recipientId,
        const std::vector<unsigned char>& plainText
    );
    
    std::vector<unsigned char> decryptMessage(
        const std::string& senderId,
        const std::vector<unsigned char>& cipherText
    );

    void performKeyRotation(const std::string& recipientId);
    bool saveKeyMaterial(const std::string& filePath);
    bool loadKeyMaterial(const std::string& filePath);
    bool hasActiveSession(const std::string& participantId);
};

#endif