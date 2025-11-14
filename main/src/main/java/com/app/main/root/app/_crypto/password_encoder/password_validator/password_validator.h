#ifndef PASSWORD_VALIDATOR_H
#define PASSWORD_VALIDATOR_H

#include <string>

class PasswordValidator {
public:
    static bool isPasswordStrong(const std::string& password);
    static bool meetsLengthRequirement(const std::string& password, int minLength = 8);
    static bool hasUpperCase(const std::string& password);
    static bool hasLowerCase(const std::string& password);
    static bool hasDigits(const std::string& password);
    static bool hasSpecialChars(const std::string& password);
};

#endif