#ifndef PRE_KEYS_H
#define PRE_KEYS_H

#include <vector>
#include <cstdint>
#include <map>
#include <openssl/ec.h>

struct SignedPreKey {
    EC_KEY* keyPair;
    std::vector<unsigned char> signature;
    uint32_t keyId;
};

struct PreKeyBundle {
    uint32_t registrationId;
    uint32_t deviceId;
    std::vector<unsigned char> identityKey;
    std::vector<unsigned char> signedPreKey;
    std::vector<unsigned char> signature;
    uint32_t preKeyId;
    std::vector<unsigned char> preKey;
};

class PreKeyManager {
private:
    std::map<uint32_t, EC_KEY*> preKeys;
    SignedPreKey signedPreKey;
    uint32_t registrationId;
    uint32_t deviceId;

public:
    PreKeyManager();
    ~PreKeyManager();
    
    void generatePreKeys(size_t count);
    void generateSignedPreKey(EC_KEY* identityPrivateKey);
    PreKeyBundle getPreKeyBundle(const std::vector<unsigned char>& identityPublicKey);
    EC_KEY* getPreKey(uint32_t keyId);
    void removePreKey(uint32_t keyId);
    
    uint32_t getRegistrationId() const { return registrationId; }
    uint32_t getDeviceId() const { return deviceId; }
};

#endif