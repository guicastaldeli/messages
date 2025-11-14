#include "user_validator.h"

UserValidator::UserValidator() {}

UserValidator::~UserValidator() {}

bool UserValidator::validateRegistration(
    const std::string& username,
    const std::string& email,
    const std::string& password,
    const std::string& ipAddress
) {
    if(rateLimiter.isRegistrationRateLimited(ipAddress)) return false;
    if(!validateUsername(username)) return false;
    if(!validateEmail(email)) return false;
    if(!validatePassword(password)) return false;
    if(InputSanitizer::hasSuspiciousPatterns(username) || InputSanitizer::hasSuspiciousPatterns(email)) return false;
    if(emailValidator.isDisposableEmail(email)) return false;
    return true;
}

bool UserValidator::validateLogin(
    const std::string& email,
    const std::string& password,
    const std::string& ipAddress
) {
    if(rateLimiter.isLoginRateLimited(ipAddress)) return false;
    if(!validateEmail(email)) return false;
    if(password.empty()) return false;
    return true;
}

bool UserValidator::validateUsername(const std::string& username) {
    return usernameValidator.validate(username);
}

bool UserValidator::validateEmail(const std::string& email) {
    return emailValidator.validate(email);
}

bool UserValidator::validatePassword(const std::string& password) {
    return passwordValidator.validate(password);
}

void UserValidator::recordRegistrationAttempt(const std::string& ipAddress) {
    rateLimiter.recordRegistrationAttempt(ipAddress);
}

void UserValidator::recordLoginAttempt(const std::string& ipAddress) {
    rateLimiter.recordLoginAttempt(ipAddress);
}

bool UserValidator::isRegistrationRateLimited(const std::string& ipAddress) {
    return rateLimiter.isRegistrationRateLimited(ipAddress);
}

bool UserValidator::isLoginRateLimited(const std::string& ipAddress) {
    return rateLimiter.isLoginRateLimited(ipAddress);
}

bool UserValidator::hasSuspiciousActivity(const std::string& ipAddress) {
    return rateLimiter.hasSuspiciousActivity(ipAddress);
}

void UserValidator::clearRateLimit(const std::string& ipAddress) {
    rateLimiter.clearRateLimit(ipAddress);
}

std::string UserValidator::sanitizeInput(const std::string& input) {
    return InputSanitizer::sanitizeInput(input);
}

bool UserValidator::containsSuspiciousPatterns(const std::string& input) {
    return InputSanitizer::containsSuspiciousPatterns(input);
}