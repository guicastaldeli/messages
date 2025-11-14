#include "password_encoder.h"
#include <sstream>
#include <iostream>
#include <stdexcept>

PasswordEncoder::PasswordEncoder() {}
PasswordEncoder::~PasswordEncoder() {}

std::string PasswordEncoder::encode(const std::string& password) {
    if(password.empty()) {
        throw std::invalid_argument("Password cannot be empty!");
    }

    auto salt = SaltGenerator::generateSalt();
    auto pepperedPassword = pepperManager.applyPepper(password);
    auto hash = HashGenerator::generateSecureHash(pepperedPassword, salt);

    std::stringstream ss;
    ss << "2$" << 1000 << "$";

    auto saltB64 = Base64Manager::base64Encode(salt);
    auto hashB64 = Base64Manager::base64Encode(hash);

    ss << saltB64 << "$" << hashB64;
    return ss.str();
}

bool PasswordEncoder::matches(
    const std::string& password,
    const std::string& encodedPassword
) {
    try {
        size_t firstDelim = encodedPassword.find('$');
        if(firstDelim == std::string::npos) {
            std::cerr << "Invalid encoded password format: missing first $" << std::endl;
            return false;
        }
        
        size_t secondDelim = encodedPassword.find('$', firstDelim + 1);
        if(secondDelim == std::string::npos) {
            std::cerr << "Invalid encoded password format: missing second $" << std::endl;
            return false;
        }
        
        size_t thirdDelim = encodedPassword.find('$', secondDelim + 1);
        if(thirdDelim == std::string::npos) {
            std::cerr << "Invalid encoded password format: missing third $" << std::endl;
            return false;
        }

        std::string version = encodedPassword.substr(0, firstDelim);
        std::string iterationsStr = encodedPassword.substr(firstDelim + 1, secondDelim - firstDelim - 1);
        std::string saltStr = encodedPassword.substr(secondDelim + 1, thirdDelim - secondDelim - 1);
        std::string storedHashStr = encodedPassword.substr(thirdDelim + 1);

        std::vector<unsigned char> salt = Base64Manager::base64Decode(saltStr);
        std::vector<unsigned char> storedHash = Base64Manager::base64Decode(storedHashStr);
        
        std::vector<unsigned char> peppered = pepperManager.applyPepper(password);
        std::vector<unsigned char> newHash = HashGenerator::generateSecureHash(peppered, salt);
        
        bool result = HashGenerator::constantTimeEquals(newHash, storedHash);
        return result;
    } catch(const std::exception& e) {
        std::cerr << "Exception in matches: " << e.what() << std::endl;
        return false;
    } catch(...) {
        std::cerr << "Unknown exception in matches" << std::endl;
        return false;
    }
}

bool PasswordEncoder::isPasswordStrong(const std::string& password) {
    return PasswordValidator::isPasswordStrong(password);
}

std::string PasswordEncoder::generateSecurePassword(int length) {
    return CryptoGenerator::generateSecurePassword(length);
}