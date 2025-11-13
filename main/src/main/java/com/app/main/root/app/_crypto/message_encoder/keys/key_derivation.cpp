#include "key_derivation.h"
#include <openssl/hmac.h>
#include <algorithm>

std::vector<unsigned char> KeyDerivation::HKDF(
    const std::vector<unsigned char>& salt,
    const std::vector<unsigned char>& ikm,
    const std::vector<unsigned char>& info,
    size_t length
) {
    std::vector<unsigned char> prk(EVP_MAX_MD_SIZE);
    unsigned int prk_len = 0;
    const unsigned char* saltData = salt.empty() ? nullptr : salt.data(); 

    HMAC(
        EVP_sha256(),
        saltData, 
        salt.size(),
        ikm.data(),
        ikm.size(),
        prk.data(),
        &prk_len
    );
    prk.resize(prk_len);

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

        HMAC(
            EVP_sha256(),
            prk.data(),
            prk.size(),
            input.data(),
            input.size(),
            round.data(),
            &round_len
        );
        round.resize(round_len);

        size_t bytes_to_take = std::min(bytes_remaining, static_cast<size_t>(round_len));
        okm.insert(okm.end(), round.begin(), round.begin() + bytes_to_take);
        t = round;
        bytes_remaining -= bytes_to_take;
    }

    return okm;
}

std::vector<unsigned char> KeyDerivation::KDF_RK(
    const std::vector<unsigned char>& rootKey,
    const std::vector<unsigned char>& dhOutput
) {
    std::vector<unsigned char> salt(32, 0);
    std::vector<unsigned char> info = {'X', '3', 'D', 'H'};
    return HKDF(rootKey, dhOutput, info, 64);
}

std::vector<unsigned char> KeyDerivation::KDF_CK(const std::vector<unsigned char>& chainKey) {
    std::vector<unsigned char> salt;
    std::vector<unsigned char> message_key_info = {
        'm', 'e', 's', 's', 'a', 'g', 'e', ' ', 'k', 'e', 'y'
    };
    std::vector<unsigned char> chain_key_info = {
        'c', 'h', 'a', 'i', 'n', ' ', 'k', 'e', 'y'
    };
    auto output = HKDF(chainKey, salt, chain_key_info, 64);
    return output;
}