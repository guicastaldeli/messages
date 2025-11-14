#ifndef CRYPTO_GENERATOR_H
#define CRYPTO_GENERATOR_H

#include <string>
#include <vector>

class CryptoGenerator {
public:
    static std::string generateSecurePassword(int length = 12);
    static bool generateRandomBytes(std::vector<unsigned char>& buffer);
    static bool generateRandomBytes(unsigned char* buffer, size_t length);
};

#endif