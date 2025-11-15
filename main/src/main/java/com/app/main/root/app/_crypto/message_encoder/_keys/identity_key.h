#ifndef IDENTITY_KEY_H
#define IDENTITY_KEY_H

#include <vector>
#include <openssl/ec.h>

struct IdentityKeyPair {
    EC_KEY* keyPair;
    std::vector<unsigned char> publicKey;
};

class IdentityKeyManager {
private:
    IdentityKeyPair identityKey;

public:
    IdentityKeyManager();
    ~IdentityKeyManager();
    
    void generateIdentityKey();
    std::vector<unsigned char> getPublicKey() const;
    EC_KEY* getPrivateKey() const;
};

#endif