#ifndef EMAIL_VALIDATOR_H
#define EMAIL_VALIDATOR_H

#include <string>
#include <regex>

class EmailValidator {
private:
    static const int MAX_EMAIL_LENGTH = 254;
    std::regex emailRegex;

public:
    EmailValidator();
    
    bool isValidFormat(const std::string& email);
    bool isDisposableEmail(const std::string& email);
    bool validate(const std::string& email);
    static bool meetsLengthRequirements(const std::string& email);
};

#endif