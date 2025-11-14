#ifndef USER_VALIDATOR_H
#define USER_VALIDATOR_H

#include "email/email_validator.h"
#include "username/username_validator.h"
#include "password/password_validator.h"
#include "rate_limiter/rate_limiter.h"
#include "input_sanitizer/input_sanitizer.h"
#include <string>

class UserValidator {
private:
    EmailValidator emailValidator;
    UsernameValidator usernameValidator;
    PasswordValidator passwordValidator;
    RateLimiter rateLimiter;

public:
    UserValidator();
    ~UserValidator();

    bool validateRegistration(
        const std::string& username,
        const std::string& email,
        const std::string& password,
        const std::string& ipAddress
    );
    
    bool validateLogin(
        const std::string& email,
        const std::string& password,
        const std::string& ipAddress
    );

    bool validateUsername(const std::string& username);
    bool validateEmail(const std::string& email);
    bool validatePassword(const std::string& password);

    void recordRegistrationAttempt(const std::string& ipAddress);
    void recordLoginAttempt(const std::string& ipAddress);
    bool isRegistrationRateLimited(const std::string& ipAddress);
    bool isLoginRateLimited(const std::string& ipAddress);
    bool hasSuspiciousActivity(const std::string& ipAddress);
    void clearRateLimit(const std::string& ipAddress);
    
    std::string sanitizeInput(const std::string& input);
    bool containsSuspiciousPatterns(const std::string& input);
};

#endif