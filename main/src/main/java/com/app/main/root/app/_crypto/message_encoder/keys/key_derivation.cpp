#include "key_derivation.h"
#include <openssl/hmac.h>
#include <openssl/kdf.h>
#include <algorithm>
#include <stdexcept>

std::vector<unsigned char> KeyDerivation::HKDF(
    const std::vector<unsigned char>& salt,
    const std::vector<unsigned char>& ikm,
    const std::vector<unsigned char>& info,
    size_t length
) {
    if(ikm.empty()) throw std::runtime_error("ikm cannot be empty!");

    std::vector<unsigned char> actualSalt = salt;
    if(actualSalt.empty()) {
        actualSalt = std::vector<unsigned char>(32, 0);
    }

    std::vector<unsigned char> prk(EVP_MAX_MD_SIZE);
    unsigned int prkLen = 0;
    
    const unsigned char* saltData = salt.empty() ? nullptr : salt.data();
    size_t saltLen = salt.empty() ? 0 : salt.size();

    if(
        !HMAC(
            EVP_sha256(), 
            saltData, 
            saltLen,
            ikm.data(), 
            ikm.size(),
            prk.data(), 
            &prkLen
        )
    ) {
        throw std::runtime_error("HKDF failed");
    }
    prk.resize(prkLen);

    std::vector<unsigned char> okm;
    std::vector<unsigned char> t;
    size_t bytes_remaining = length;
    uint8_t counter = 1;

    while(bytes_remaining > 0) {
        std::vector<unsigned char> input = t;
        input.insert(input.end(), info.begin(), info.end());
        input.push_back(counter++);

        std::vector<unsigned char> round(EVP_MAX_MD_SIZE);
        unsigned int round_len = 0;

        if(
            !HMAC(
                EVP_sha256(),
                prk.data(), 
                prk.size(),
                input.data(), 
                input.size(),
                round.data(), 
                &round_len
            )
        ) {
            throw std::runtime_error("HKDF failed");
        }
        round.resize(round_len);

        size_t bytes_to_take = std::min(bytes_remaining, static_cast<size_t>(round_len));
        okm.insert(okm.end(), round.begin(), round.begin() + bytes_to_take);
        t = round;
        bytes_remaining -= bytes_to_take;
    }

    if(okm.size() != length) throw std::runtime_error("HKDF output length mismatch");
    return okm;
}

std::vector<unsigned char> KeyDerivation::KDF_RK(
    const std::vector<unsigned char>& rootKey,
    const std::vector<unsigned char>& dhOutput
) {
    if(rootKey.size() != 32) throw std::runtime_error("Root key must be 32 bytes");
    if(dhOutput.empty()) throw std::runtime_error("DH output cannot be empty");

    std::vector<unsigned char> info = {
        'X', '3', 'D', 'H', 
        ' ', 'R', 'o', 'o', 't', ' ', 'K', 'e', 'y'
    };
    return HKDF(rootKey, dhOutput, info, 64);
}

std::vector<unsigned char> KeyDerivation::KDF_CK(const std::vector<unsigned char>& chainKey) {
    if(chainKey.size() != 32) throw std::runtime_error("chain key must be 32 bytes!");

    std::vector<unsigned char> salt;
    std::vector<unsigned char> ikm;
    ikm = chainKey;
    
    std::vector<unsigned char> info = {
        'm', 'e', 's', 's', 'a', 'g', 'e', ' ', 'k', 'e', 'y'
    };
    auto output = HKDF(salt, ikm, info, 64);
    return output;
}