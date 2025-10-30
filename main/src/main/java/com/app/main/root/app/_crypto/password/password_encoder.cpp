#include "password_encoder.h"
#include <algorithm>
#include <random>
#include <sstream>
#include <iomanip>
#include <stdexcept>

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
    if(RAND_bytes(pepper.data(), pepper.size()) != 1) {
        throw std::runtime_error("Failed to generate pepper");
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
    try {
        std::vector<unsigned char> memoryBuffer(MEMORY_COST);
        std::vector<unsigned char> block(EVP_MAX_MD_SIZE);
        unsigned int blockLen = 0;

        EVP_MD_CTX* ctx = EVP_MD_CTX_new();
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

        for(int i = 0; i < MEMORY_COST; i++) {
            size_t pos = i % memoryBuffer.size();
            size_t copyLen = (std::min)(block.size(), memoryBuffer.size() - pos);
            std::copy(
                block.begin(),
                block.begin() + copyLen,
                memoryBuffer.begin() + pos
            );

            EVP_DigestInit_ex(ctx, EVP_sha512(), nullptr);
            EVP_DigestUpdate(ctx, block.data(), block.size());
            EVP_DigestFinal_ex(ctx, block.data(), &blockLen);
            block.resize(blockLen);
        }

        std::vector<unsigned char> result(64);
        const int parallelism = 2;

        for(int i = 0; i < parallelism; i++) {
            int segmentSize = MEMORY_COST / parallelism;
            int segmentStart = i * segmentSize;
            EVP_DigestInit_ex(ctx, EVP_sha512(), nullptr);
            EVP_DigestUpdate(ctx, memoryBuffer.data() + segmentStart, segmentSize);
            EVP_DigestFinal_ex(ctx, result.data() + (i * 32), &blockLen);
        }
        EVP_MD_CTX_free(ctx);

        std::vector<unsigned char> finalResult(EVP_MAX_MD_SIZE);
        EVP_Digest(
            result.data(),
            result.size(),
            finalResult.data(),
            &blockLen,
            EVP_sha512(),
            nullptr
        );
        return finalResult;
    } catch(...) {
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
        size_t pos1 = encodedPassword.find('$');
        size_t pos2 = encodedPassword.find('$', pos1 + 1);
        size_t pos3 = encodedPassword.find('$', pos2 + 1);
        if(
            pos1 == std::string::npos ||
            pos2 == std::string::npos ||
            pos3 == std::string::npos
        ) {
            return false;
        }

        int version = std::stoi(encodedPassword.substr(0, pos1));
        int iterations = std::stoi(encodedPassword.substr(pos1 + 1, pos2 - pos1 - 1));
        std::string saltB64 = encodedPassword.substr(pos2 + 1, pos3 - pos2 - 1);
        std::string hashB64 = encodedPassword.substr(pos3 + 1);

        auto salt = base64Decode(saltB64);
        auto storedHash = base64Decode(hashB64);
        auto pepperedPassword = applyPepper(password);
        auto testHash = generateSecureHash(pepperedPassword, salt);
        return constantTimeEquals(testHash, storedHash);
    } catch(...) {
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
        "0123456789+/";

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

    auto is_base64 = [](unsigned char c) {
        return(isalnum(c) || (c == '+') || (c == '/'));
    };

    int in_len = encoded_string.size();
    int i = 0;
    int j = 0;
    int in_ = 0;
    unsigned char char_array_4[4];
    unsigned char char_array_3[3];
    std::vector<unsigned char> ret;

    while(
        in_len-- &&
        (encoded_string[in_] != '=') &&
        is_base64(encoded_string[in_])
    ) {
        char_array_4[i++] = encoded_string[in_];
        in_++;

        if(i == 4) {
            for(i = 0; i < 4; i++) char_array_4[i] = base64_chars.find(char_array_4[i]);

            char_array_3[0] = (char_array_4[0] << 2) + ((char_array_4[1] & 0x30) >> 4);
            char_array_3[1] = ((char_array_4[1] & 0xf) << 4) + ((char_array_4[2] & 0x3c) >> 2);
            char_array_3[2] = ((char_array_4[2] & 0x3) << 6) + char_array_4[3];

            for(i = 0; i < 3; i++) ret.push_back(char_array_3[i]);
            i = 0;
        }

        if(i) {
            for(j = i; j < 4; j++) char_array_4[j] = 0;

            char_array_3[0] = (char_array_4[0] << 2) + ((char_array_4[1] & 0x30) >> 4);
            char_array_3[1] = ((char_array_4[1] & 0xf) << 4) + ((char_array_4[2] & 0x3c) >> 2);
            char_array_3[2] = ((char_array_4[2] & 0x3) << 6) + char_array_4[3];
            
            for(j = 0; j < i - 1; j++) ret.push_back(char_array_3[j]);
        }
    }

    return ret;
}