#include "crypto_generator.h"
#include <openssl/rand.h>
#include <random>
#include <algorithm>
#include <stdexcept>

std::string CryptoGenerator::generateSecurePassword(int length) {
    if(length < 12) length = 12;

    const std::string upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
    const std::string lower = "abcdefghjkmnpqrstuvwxyz";
    const std::string digits = "23456789";
    const std::string special = "!@#$%^&*";
    const std::string allChars = upper + lower + digits + special;

    std::random_device rd;
    std::mt19937 gen(rd());
    std::uniform_int_distribution<> dis(0, allChars.size() - 1);

    std::string password;
    std::uniform_int_distribution<> upperDis(0, upper.size() - 1);
    std::uniform_int_distribution<> lowerDis(0, lower.size() - 1);
    std::uniform_int_distribution<> digitDis(0, digits.size() - 1);
    std::uniform_int_distribution<> specialDis(0, special.size() - 1);
    
    password += upper[upperDis(gen)];
    password += lower[lowerDis(gen)];
    password += digits[digitDis(gen)];
    password += special[specialDis(gen)];
    
    for(int i = 4; i < length; i++) {
        password += allChars[dis(gen)];
    }
    
    std::shuffle(password.begin(), password.end(), gen);
    return password;
}

bool CryptoGenerator::generateRandomBytes(std::vector<unsigned char>& buffer) {
    return RAND_bytes(buffer.data(), buffer.size()) == 1;
}

bool CryptoGenerator::generateRandomBytes(unsigned char* buffer, size_t length) {
    return RAND_bytes(buffer, length) == 1;
}