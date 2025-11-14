#ifndef PASSWORD_ENCODER_H
#define PASSWORD_ENCODER_H

#include "pepper_manager.h"
#include "salt_generator.h"
#include "hash_generator.h"
#include "password_validator.h"
#include "base64_manager.h"
#include "crypto_generator.h"
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