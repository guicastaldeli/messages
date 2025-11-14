#include "username_validator.h"
#include "reserved_username_list.h"
#include "../input_sanitizer/suspicious_pattern_list.h"
#include <algorithm>
#include <cctype>

UsernameValidator::UsernameValidator() : 
    usernameRegex(R"(^[a-zA-Z0-9_]{3,50}$)") 
{}

bool UsernameValidator::isValidFormat(const std::string& username) {
    return std::regex_match(username, usernameRegex);
}

bool UsernameValidator::isReserved(const std::string& username) {
    std::string lowerUsername = username;
    std::transform(lowerUsername.begin(), lowerUsername.end(), lowerUsername.begin(), ::tolower);

    for(const auto& reserved : ReservedUsernameList::LIST) {
        if(lowerUsername == reserved) {
            return true;
        }
    }

    return false;
}

bool UsernameValidator::hasSuspiciousPatterns(const std::string& username) {
    if(username.length() >= 3) {
        for(size_t i = 0; i < username.length() - 2; i++) {
            if(
                std::isalpha(username[i]) && 
                std::isalpha(username[i + 1]) &&
                std::isalpha(username[i + 2])
            ) {
                if(
                    (
                        username[i] + 1 == username[i + 1] && 
                        username[i + 1] + 1 == username[i + 2]
                    ) ||
                    (
                        username[i] - 1 == username[i + 1] && 
                        username[i + 1] - 1 == username[i + 2]
                    )
                )  {
                    return true;
                }
            }
        }
    }
    if(username.length() >= 4) {
        for(size_t i = 0; i < username.length() - 3; ++i) {
            std::string pattern = username.substr(i, 2);
            if(username.substr(i + 2, 2) == pattern) {
                return true;
            }
        }
    }

    return false;
}

bool UsernameValidator::validate(const std::string& username) {
    if(!meetsLengthRequirements(username)) return false;
    if(!isValidFormat(username)) return false;
    if(isReserved(username)) return false;
    return !hasSuspiciousPatterns(username);
}

bool UsernameValidator::meetsLengthRequirements(const std::string& username) {
    return username.length() >= MIN_USERNAME_LENGTH && username.length() <= MAX_USERNAME_LENGTH;
}