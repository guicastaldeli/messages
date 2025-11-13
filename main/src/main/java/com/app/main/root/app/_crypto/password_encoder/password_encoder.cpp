#include "password_encoder.h"
#include <algorithm>
#include <random>
#include <sstream>
#include <iomanip>
#include <stdexcept>
#include <iostream>
#include <cctype>
#include <cstdlib>
#include <fstream>

#ifdef _WIN32
#include <windows.h>
#include <wincrypt.h>
#undef min
#undef max
#else
#include <unistd.h>
#include <sys/syscall.h>
#endif

PasswordEncoder::PasswordEncoder() {
    pepper.resize(32);
    std::string pepperFile = "pepper.bin";

    std::ifstream file(pepperFile, std::ios::binary);
    if(file && file.good()) {
        file.read(reinterpret_cast<char*>(pepper.data()), pepper.size());
        if(file.gcount() != 32) {
            std::cerr << "Warning: Pepper file corrupted, generating new one" << std::endl;
            generateNewPepper(pepperFile);
        } else {
            std::cout << "Loading pepper from file" << std::endl;
        }
    } else {
        generateNewPepper(pepperFile);
    }
}

void PasswordEncoder::generateNewPepper(const std::string& fileName) {
    if(RAND_bytes(pepper.data(), pepper.size()) != 1) {
        throw std::runtime_error("Failed to generate pepper");
    }

    std::ofstream outFile(fileName, std::ios::binary);
    if(outFile) {
        outFile.write(reinterpret_cast<const char*>(pepper.data()), pepper.size());
        std::cout << "Genereated and saved new pepper" << std::endl;
    } else {
        std::cerr << "Warning: Could not save pepper to file" << std::endl;
    }
}

PasswordEncoder::~PasswordEncoder() {
    std::fill(pepper.begin(), pepper.end(), 0);
}

/*
** Generate Salt
*/
std::vector<unsigned char> PasswordEncoder::generateSalt() {
    std::vector<unsigned char> salt(SALT_LENGTH);
    if(RAND_bytes(salt.data(), salt.size()) != 1) {
        throw std::runtime_error("failed to generate salt");
    }
    return salt;
}

/*
** Apply Pepper
*/
std::vector<unsigned char> PasswordEncoder::applyPepper(const std::string& password) {
    std::vector<unsigned char> result(EVP_MAX_MD_SIZE);
    unsigned int resultLen = 0;

    const EVP_MD* md = EVP_sha512();
    HMAC(
        md,
        pepper.data(),
        pepper.size(),
        reinterpret_cast<const unsigned char*>(password.data()),
        password.size(),
        result.data(),
        &resultLen
    );
    result.resize(resultLen);
    return result;
}

std::vector<unsigned char> PasswordEncoder::generateSecureHash(
    const std::vector<unsigned char>& pepperedPassword,
    const std::vector<unsigned char>& salt
) {
    std::vector<unsigned char> key(HASH_KEY_LENGTH / 8);
    if(PKCS5_PBKDF2_HMAC(
       reinterpret_cast<const char*>(pepperedPassword.data()),
       static_cast<int>(pepperedPassword.size()),
       salt.data(),
       static_cast<int>(salt.size()),
       HASH_ITERATIONS,
       EVP_sha512(),
       static_cast<int>(key.size()),
       key.data()) != 1
    ) {
        throw std::runtime_error("PBKDF2 failed");
    }

    auto memoryHardResult = applyMemoryHardFunction(key, salt);
    return applyFinalHmac(memoryHardResult, salt);
}

std::vector<unsigned char> PasswordEncoder::applyMemoryHardFunction(
    const std::vector<unsigned char>& input,
    const std::vector<unsigned char>& salt
) {
    EVP_MD_CTX* ctx = nullptr;

    try {
        const size_t MEMORY_SIZE = 8192;
        std::vector<unsigned char> memoryBuffer(MEMORY_SIZE);
        std::vector<unsigned char> block(EVP_MAX_MD_SIZE);
        unsigned int blockLen = 0;

        ctx = EVP_MD_CTX_new();
        if(!ctx) throw std::runtime_error("EVP_MD_CTX_new failed");

        std::vector<unsigned char> combined(input.size() + salt.size());
        std::copy(
            input.begin(),
            input.end(),
            combined.begin()
        );
        std::copy(
            salt.begin(),
            salt.end(),
            combined.begin() + input.size()
        );
        
        EVP_DigestInit_ex(ctx, EVP_sha512(), nullptr);
        EVP_DigestUpdate(ctx, combined.data(), combined.size());
        EVP_DigestFinal_ex(ctx, block.data(), &blockLen);
        block.resize(blockLen);

        const int INTERATIONS = 1000;
        for(int i = 0; i < INTERATIONS; i++) {
            size_t pos = i % MEMORY_SIZE;
            size_t availableSpace = MEMORY_SIZE - pos;
            size_t copyLen = (std::min)(block.size(), availableSpace);
            std::copy(
                block.begin(),
                block.begin() + copyLen,
                memoryBuffer.begin() + pos
            );

            if(EVP_DigestInit_ex(ctx, EVP_sha512(), nullptr) != 1) {
                throw std::runtime_error("EVP_DigestInit_ex failed in loop");
            }
            if(EVP_DigestUpdate(ctx, block.data(), block.size()) != 1) {
                throw std::runtime_error("EVP_DigestUpdate failed in loop");
            }
            if(EVP_DigestFinal_ex(ctx, block.data(), &blockLen) != 1) {
                throw std::runtime_error("EVP_DigestFinal_ex failed in loop");
            }
            block.resize(blockLen);
        }

        std::vector<unsigned char> result(64);
        if(EVP_DigestInit_ex(ctx, EVP_sha512(), nullptr) != 1) {
            throw std::runtime_error("EVP_DigestInit_ex failed in final");
        }
        if(EVP_DigestUpdate(ctx, memoryBuffer.data(), memoryBuffer.size()) != 1) {
            throw std::runtime_error("EVP_DigestUpdate failed in final");
        }
        if(EVP_DigestFinal_ex(ctx, result.data(), &blockLen) != 1) {
            throw std::runtime_error("EVP_DigestFinal_ex failed in final");
        }
        result.resize(blockLen);
        EVP_MD_CTX_free(ctx);
        ctx = nullptr;

        return result;
    } catch(...) {
        if(ctx) EVP_MD_CTX_free(ctx);
        return input;
    }
}

/*
** Apply Final HMac
*/
std::vector<unsigned char> PasswordEncoder::applyFinalHmac(
    const std::vector<unsigned char>& input,
    const std::vector<unsigned char>& salt
) {
    std::vector<unsigned char> result(EVP_MAX_MD_SIZE);
    unsigned int resultLen = 0;

    const EVP_MD* md = EVP_sha512();
    HMAC(
        md,
        salt.data(),
        salt.size(),
        input.data(),
        input.size(),
        result.data(),
        &resultLen
    );
    result.resize(resultLen);
    return result;
}

bool PasswordEncoder::constantTimeEquals(
    const std::vector<unsigned char>& a,
    const std::vector<unsigned char>& b
) {
    if(a.size() != b.size()) return false;
    unsigned char result = 0;
    for(size_t i = 0; i < a.size(); i++) {
        result |= a[i] ^ b[i];
    } 
    return result == 0;
}

/*
** Encode
*/
std::string PasswordEncoder::encode(const std::string& password) {
    if(password.empty()) throw std::invalid_argument("Password cannot be empty!");

    auto salt = generateSalt();
    auto pepperedPassword = applyPepper(password);
    auto hash = generateSecureHash(pepperedPassword, salt);

    std::stringstream ss;
    ss << "2$" << HASH_ITERATIONS << "$";

    auto saltB64 = base64Encode(salt);
    auto hashB64 = base64Encode(hash);

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

        std::vector<unsigned char> salt = base64Decode(saltStr);
        std::vector<unsigned char> storedHash = base64Decode(storedHashStr);
        
        std::vector<unsigned char> peppered = applyPepper(password);
        std::vector<unsigned char> newHash = generateSecureHash(peppered, salt);
        std::string newHashStr = base64Encode(newHash);
        
        std::vector<unsigned char> newHashVec = base64Decode(newHashStr);
        bool result = constantTimeEquals(newHashVec, storedHash);
        
        return result;
    } catch(const std::exception& e) {
        std::cerr << "Exception **matches" << e.what() << std::endl;
        return false;
    } catch(...) {
        std::cerr << "Unknown exception **matches" << std::endl;
        return false;
    }
}

bool PasswordEncoder::isPasswordStrong(const std::string& password) {
    if(password.length() < 8) return false;

    bool hasUpper = false;
    bool hasLower = false;
    bool hasDigit = false;
    bool hasSpecial = false;
    std::string specialChar = "!@#$%^&*()_+-=[]{}|;:,.<>?";

    for(char c : password) {
        if(std::isupper(c)) {
            hasUpper = true;
        } else if(std::islower(c)) {
            hasLower = true;
        } else if(std::isdigit(c)) {
            hasDigit = true;
        } else if(specialChar.find(c) != std::string::npos) {
            hasSpecial = true;
        }
    }

    int requirementsMet = 0;
    if(hasUpper) requirementsMet++;
    if(hasLower) requirementsMet++;
    if(hasDigit) requirementsMet++;
    if(hasSpecial) requirementsMet++;
    return requirementsMet >= 3 && password.length() >= 8;
}

/*
** Generate Secure Password
*/
std::string PasswordEncoder::generateSecurePassword(int length) {
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
    for(int i = 4; i < length; i++) password += allChars[dis(gen)];
    std::shuffle(password.begin(), password.end(), gen);

    return password;
}

std::string PasswordEncoder::base64Encode(const std::vector<unsigned char>& data) {
    const std::string base64_chars =
        "ABCDEFGHIJKLMNOPQRSTUVWXYZ"
        "abcdefghijklmnopqrstuvwxyz"
        "0123456789-_";

    std::string ret;
    int i = 0;
    int j = 0;
    unsigned char char_array_3[3];
    unsigned char char_array_4[4];

    for(size_t idx = 0; idx < data.size(); idx++) {
        char_array_3[i++] = data[idx];
        if(i == 3) {
            char_array_4[0] = (char_array_3[0] & 0xfc) >> 2;
            char_array_4[1] = ((char_array_3[0] & 0x03) << 4) + ((char_array_3[1] & 0xf0) >> 4);
            char_array_4[2] = ((char_array_3[1] & 0x0f) << 2) + ((char_array_3[2] & 0xc0) >> 6);
            char_array_4[3] = char_array_3[2] & 0x3f;

            for(i = 0; i < 4; i++) ret += base64_chars[char_array_4[i]];
            i = 0;
        }
    }

    if(i) {
        for(j = i; j < 3; j++) char_array_3[j] = '\0';

        char_array_4[0] = (char_array_3[0] & 0xfc) >> 2;
        char_array_4[1] = ((char_array_3[0] & 0x03) << 4) + ((char_array_3[1] & 0xf0) >> 4);
        char_array_4[2] = ((char_array_3[1] & 0x0f) << 2) + ((char_array_3[2] & 0xc0) >> 6);
        char_array_4[3] = char_array_3[2] & 0x3f;

        for(j = 0; j < i + 1; j++) ret += base64_chars[char_array_4[j]];
        while(i++ < 3) ret += '=';
    }

    return ret;
}

std::vector<unsigned char> PasswordEncoder::base64Decode(const std::string& encoded_string) {    
    const std::string base64_chars = 
        "ABCDEFGHIJKLMNOPQRSTUVWXYZ"
        "abcdefghijklmnopqrstuvwxyz"
        "0123456789+/";

    std::string standard_encoded = encoded_string;
    std::replace(standard_encoded.begin(), standard_encoded.end(), '-', '+');
    std::replace(standard_encoded.begin(), standard_encoded.end(), '_', '/');

    auto is_base64 = [](unsigned char c) {
        return (isalnum(c) || (c == '+') || (c == '/'));
    };

    int in_len = standard_encoded.size();
    int i = 0;
    int j = 0;
    int in_ = 0;
    unsigned char char_array_4[4], char_array_3[3];
    std::vector<unsigned char> ret;

    while (
        in_len-- && 
        (standard_encoded[in_] != '=') && 
        is_base64(standard_encoded[in_])
    ) {
        char_array_4[i++] = standard_encoded[in_]; 
        in_++;
        
        if(i == 4) {
            for(i = 0; i < 4; i++) {
                char_array_4[i] = base64_chars.find(char_array_4[i]);
            }

            char_array_3[0] = (char_array_4[0] << 2) + ((char_array_4[1] & 0x30) >> 4);
            char_array_3[1] = ((char_array_4[1] & 0xf) << 4) + ((char_array_4[2] & 0x3c) >> 2);
            char_array_3[2] = ((char_array_4[2] & 0x3) << 6) + char_array_4[3];

            for(i = 0; i < 3; i++) {
                ret.push_back(char_array_3[i]);
            }
            i = 0;
        }
    }

    if(i > 0) {
        for(j = i; j < 4; j++) {
            char_array_4[j] = 0;
        }
        for(j = 0; j < 4; j++) {
            char_array_4[j] = base64_chars.find(char_array_4[j]);
        }

        char_array_3[0] = (char_array_4[0] << 2) + ((char_array_4[1] & 0x30) >> 4);
        char_array_3[1] = ((char_array_4[1] & 0xf) << 4) + ((char_array_4[2] & 0x3c) >> 2);
        char_array_3[2] = ((char_array_4[2] & 0x3) << 6) + char_array_4[3];

        for(j = 0; j < i - 1; j++) {
            ret.push_back(char_array_3[j]);
        }
    }

    return ret;
}