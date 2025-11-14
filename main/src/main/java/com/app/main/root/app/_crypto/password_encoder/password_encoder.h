#ifndef PASSWORD_ENCODER_H
#define PASSWORD_ENCODER_H

#include "pepper_manager/pepper_manager.h"
#include "salt_generator/salt_generator.h"
#include "hash_generator/hash_generator.h"
#include "password_validator/password_validator.h"
#include "utils/base64_manager.h"
#include "utils/crypto_generator.h"
#include <string>

class PasswordEncoder {
private:
    PepperManager pepperManager;

public:
    PasswordEncoder();
    ~PasswordEncoder();

    std::string encode(const std::string& password);
    bool matches(const std::string& password, const std::string& encodedPassword);
    bool isPasswordStrong(const std::string& password);
    std::string generateSecurePassword(int length = 12);
};

#endif