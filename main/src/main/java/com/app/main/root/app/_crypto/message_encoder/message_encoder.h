#ifndef MESSAGE_ENCODER_H
#define MESSAGE_ENCODER_H

#include "_keys/session_keys.h"
#include "_keys/identity_key.h"
#include "_keys/pre_keys.h"
#include "_crypto_operations/crypto_operations.h"
#include "_aes_operations/aes_operations.h"
#include "_keys/key_derivation.h"
#include "_utils/base64_manager.h"
#include <string>
#include <vector>
#include <mutex>

class MessageEncoder {
private:
    std::mutex sessionMutex;
    IdentityKeyManager identityManager;
    PreKeyManager preKeyManager;
    SessionManager sessionManager;

public:
    MessageEncoder();
    ~MessageEncoder();
    bool saveSessions();
    bool loadSessions();
    bool saveSessionsNow();
    bool loadSessionsNow();

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