#ifndef KEY_DERIVATION_H
#define KEY_DERIVATION_H

#include <vector>

class KeyDerivation {
public:
    static std::vector<unsigned char> HKDF(
        const std::vector<unsigned char>& salt,
        const std::vector<unsigned char>& ikm,
        const std::vector<unsigned char>& info,
        size_t length
    );
    
    static std::vector<unsigned char> KDF_RK(
        const std::vector<unsigned char>& rootKey,
        const std::vector<unsigned char>& dhOutput
    );
    
    static std::vector<unsigned char> KDF_CK(const std::vector<unsigned char>& chainKey);
};

#endif