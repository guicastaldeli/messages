#ifndef USERNAME_VALIDATOR_H
#define USERNAME_VALIDATOR_H

#include <string>
#include <regex>
#include <vector>

class UsernameValidator {
private:
    static const int MAX_USERNAME_LENGTH = 20;
    static const int MIN_USERNAME_LENGTH = 5;
    std::regex usernameRegex;

public:
    UsernameValidator();
    
    bool isValidFormat(const std::string& username);
    bool isReserved(const std::string& username);
    bool hasSuspiciousPatterns(const std::string& username);
    bool validate(const std::string& username);
    static bool meetsLengthRequirements(const std::string& username);
};

#endif