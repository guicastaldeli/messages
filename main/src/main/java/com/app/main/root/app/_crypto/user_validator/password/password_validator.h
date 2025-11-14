#ifndef PASSWORD_VALIDATOR_H
#define PASSWORD_VALIDATOR_H

#include <string>
#include <vector>

class PasswordValidator {
private:
    static const int MIN_PASSWORD_LENGTH = 8;

public:
    bool isCommonPassword(const std::string& password);
    bool validate(const std::string& password);
    static bool meetsLengthRequirements(const std::string& password);
};

#endif