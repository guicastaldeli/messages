#include "user_validator.h"
#include "disposable_email_domains.h"
#include "common_password_list.h"
#include "reserved_username_list.h"
#include "suspicious_pattern_list.h"
#include <iostream>
#include <vector>
#include <algorithm>
#include <cctype>
#include <locale>

UserValidator::UserValidator():
    emailRegex(R"(^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$)"),
    usernameRegex(R"(^[a-zA-Z0-9_]{3,50}$)"),
    passwordStrengthRegex(R"(^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$)")
{}

UserValidator::~UserValidator() {}

/*
** Email Format
*/
bool UserValidator::isValidEmailFormat(const std::string& email) {
    return std::regex_match(email, emailRegex);
}

/*
** Username Formar
*/
bool UserValidator::isValidUsernameFormat(const std::string& username) {
    return std::regex_match(username, usernameRegex);
}

/*
** Password Valid
*/
bool UserValidator::isPasswordValid(const std::string& password) {
    if(password.length() < MIN_PASSWORD_LENGTH) return false;
    std::string lowerPassword = password;
    std::transform(lowerPassword.begin(), lowerPassword.end(), lowerPassword.begin(), ::tolower);
    for(const auto& common : CommonPasswordList::LIST) {
        if(lowerPassword == common) {
            return false;
        }
    }

    return true;
}

/*
** Disposable Email
*/
bool UserValidator::isDisposableEmail(const std::string& email) {
    size_t atPos = email.find('@');
    if(atPos == std::string::npos) return false;

    std::string domain = email.substr(atPos + 1);
    std::transform(domain.begin(), domain.end(), domain.begin(), ::tolower);

    for(const auto& disposable : DisposableEmailDomains::LIST) {
        if(domain.find(disposable) != std::string::npos) {
            return true;
        }
    }

    return false;
}

/*
** Common Password
*/
bool UserValidator::isCommonPassword(const std::string& password) {
    std::string lowerPassword = password;
    std::transform(lowerPassword.begin(), lowerPassword.end(), lowerPassword.begin(), ::tolower);
    return std::find(
        CommonPasswordList::LIST.begin(), 
        CommonPasswordList::LIST.end(), 
        lowerPassword
    ) != CommonPasswordList::LIST.end();
}

bool UserValidator::hasSuspiciousPatterns(const std::string& input) {
    if(input.length() >= 3) {
        for(size_t i = 0; i < input.length() - 2; i++) {
            if(
                std::isalpha(input[i]) && 
                std::isalpha(input[i + 1]) &&
                std::isalpha(input[i + 2])
            ) {
                if(
                    (input[i] + 1 == input[i + 1] && input[i + 1] + 1 == input[i + 2]) ||
                    (input[i] - 1 == input[i + 1] && input[i + 1] - 1 == input[i + 2])
                )  {
                    return true;
                }
            }
        }
    }
    if(input.length() >= 4) {
        for(size_t i = 0; i < input.length() - 3; ++i) {
            std::string pattern = input.substr(i, 2);
            if(input.substr(i + 2, 2) == pattern) {
                return true;
            }
        }
    }

    return false;
}

void UserValidator::cleanOldAttempts(std::vector<std::chrono::steady_clock::time_point>& attempts) {
    auto now = std::chrono::steady_clock::now();
    auto threshold = now - std::chrono::milliseconds(RATE_LIMIT_WINDOW_MS);
    attempts.erase(
        std::remove_if(
            attempts.begin(), attempts.end(),
            [threshold](const auto& attempt) {
                return attempt < threshold;
            }
        ),
        attempts.end()
    );
}

bool UserValidator::isRateLimited(
    const std::string& id,
    std::unordered_map<std::string, std::vector<std::chrono::steady_clock::time_point>>& attemptsMap,
    int maxAttempts
) {
    std::lock_guard<std::mutex> lock(rateLimitMutex);
    auto& attempts = attemptsMap[id];
    cleanOldAttempts(attempts);
    return attempts.size() >= maxAttempts;
}

/*
** Validate Registration
*/
bool UserValidator::validateRegistration(
    const std::string& username,
    const std::string& email,
    const std::string& password,
    const std::string& ipAddress
) {
    if(isRegistrationRateLimited(ipAddress)) return false;
    if(!validateUsername(username)) return false;
    if(!validateEmail(email)) return false;
    if(!validatePassword(password)) return false;
    if(hasSuspiciousPatterns(username) || hasSuspiciousPatterns(email)) return false;
    if(isDisposableEmail(email)) return false;
    return true;
}

/*
** Validate Login
*/
bool UserValidator::validateLogin(
    const std::string& email,
    const std::string& password,
    const std::string& ipAddress
) {
    if(isLoginRateLimited(ipAddress)) return false;
    if(!validateEmail(email)) return false;
    if(password.empty()) return false;
    return true;
}

/*
** Validate Username
*/
bool UserValidator::validateUsername(const std::string& username) {
    if(username.length() < MIN_USERNAME_LENGTH || username.length() > MAX_USERNAME_LENGTH) {
        return false;
    }
    if(!isValidUsernameFormat(username)) {
        return false;
    }

    std::vector<std::string> reservedUsernames = ReservedUsernameList::LIST;
    std::string lowerUsername = username;
    std::transform(lowerUsername.begin(), lowerUsername.end(), lowerUsername.begin(), ::tolower);

    for(const auto& reserved : reservedUsernames) {
        if(lowerUsername == reserved) {
            return false;
        }
    }

    return !hasSuspiciousPatterns(username);
}

/*
** Validate Email
*/
bool UserValidator::validateEmail(const std::string& email) {
    if(email.length() > MAX_EMAIL_LENGTH) return false;
    if(email.empty()) return false;
    if(!isValidEmailFormat(email)) return false;
    return !isDisposableEmail(email);
}

/*
** Validate Password
*/
bool UserValidator::validatePassword(const std::string& password) {
    if(password.length() < MIN_PASSWORD_LENGTH) return false;
    if(isCommonPassword(password)) return false;
    return true;
}

void UserValidator::recordRegistrationAttempt(const std::string& ipAddress) {
    std::lock_guard<std::mutex> lock(rateLimitMutex);
    auto& attempts = registrationAttempts[ipAddress];
    attempts.push_back(std::chrono::steady_clock::now());
    cleanOldAttempts(attempts);
}

void UserValidator::recordLoginAttempt(const std::string& ipAddress) {
    std::lock_guard<std::mutex> lock(rateLimitMutex);
    auto& attempts = loginAttempts[ipAddress];
    attempts.push_back(std::chrono::steady_clock::now());
    cleanOldAttempts(attempts);
}

bool UserValidator::isRegistrationRateLimited(const std::string& ipAddress) {
    return isRateLimited(ipAddress, registrationAttempts, MAX_REGISTRATION_ATTEMPTS_PER_HOUR);
}

bool UserValidator::isLoginRateLimited(const std::string& ipAddress) {
    return isRateLimited(ipAddress, loginAttempts, MAX_LOGIN_ATTEMPTS_PER_HOUR);
}

bool UserValidator::hasSuspiciousActivity(const std::string& ipAddress) {
    std::lock_guard<std::mutex> lock(rateLimitMutex);
    auto regIt = registrationAttempts.find(ipAddress);
    auto loginIt = loginAttempts.find(ipAddress);
    int totalRecentAttempts = 0;

    if(regIt != registrationAttempts.end()) {
        cleanOldAttempts(regIt->second);
        totalRecentAttempts += regIt->second.size();
    }
    if(loginIt != loginAttempts.end()) {
        cleanOldAttempts(loginIt->second);
        totalRecentAttempts += loginIt->second.size();
    }

    return totalRecentAttempts > (MAX_REGISTRATION_ATTEMPTS_PER_HOUR + MAX_LOGIN_ATTEMPTS_PER_HOUR);
}

void UserValidator::clearRateLimit(const std::string& ipAddress) {
    std::lock_guard<std::mutex> lock(rateLimitMutex);
    registrationAttempts.erase(ipAddress);
    loginAttempts.erase(ipAddress);
}

std::string UserValidator::sanitizeInput(const std::string& input) {
    std::string sanitized = input;
    sanitized.erase(std::remove(sanitized.begin(), sanitized.end(), '\0'), sanitized.end());
    sanitized.erase(sanitized.begin(), std::find_if(sanitized.begin(), sanitized.end(), [](unsigned char ch) {
        return !std::isspace(ch);
    }));
    sanitized.erase(std::find_if(sanitized.rbegin(), sanitized.rend(), [](unsigned char ch) {
        return !std::isspace(ch);
    }).base(), sanitized.end());
    return sanitized;
}

bool UserValidator::containsSuspiciousPatterns(const std::string& input) {
    std::vector<std::string> patterns = SuspiciousPatternList::LIST;
    std::string lowerInput = input;
    std::transform(lowerInput.begin(), lowerInput.end(), lowerInput.begin(), ::tolower);

    for(const auto& pattern : patterns) {
        if(lowerInput.find(pattern) != std::string::npos) {
            return true;
        }
    }

    return false;
}

