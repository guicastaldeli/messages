#ifndef USER_VALIDATOR_H
#define USER_VALIDATOR_H

#include <jni.h>
#include <string>
#include <unordered_map>
#include <chrono>
#include <mutex>
#include <regex>
#include <algorithm>
#include <cctype>

class UserValidator {
    private:
        static const int MAX_USERNAME_LENGTH = 20;
        static const int MIN_USERNAME_LENGTH = 5;
        static const int MAX_EMAIL_LENGTH = 254;
        static const int MIN_PASSWORD_LENGTH = 8;
        static const int MAX_REGISTRATION_ATTEMPTS_PER_HOUR = 5;
        static const int MAX_LOGIN_ATTEMPTS_PER_HOUR = 10;
        static const long long RATE_LIMIT_WINDOW_MS = 3600000;

        std::unordered_map<std::string, std::vector<std::chrono::steady_clock::time_point>> registrationAttempts;
        std::unordered_map<std::string, std::vector<std::chrono::steady_clock::time_point>> loginAttempts;
        std::mutex rateLimitMutex;
        std::regex emailRegex;
        std::regex usernameRegex;
        std::regex passwordStrengthRegex;

        bool isValidEmailFormat(const std::string& email);
        bool isValidUsernameFormat(const std::string& username);
        bool isPasswordValid(const std::string& password);
        void cleanOldAttempts(std::vector<std::chrono::steady_clock::time_point>& attempts);
        bool isRateLimited(
            const std::string& id,
            std::unordered_map<std::string, std::vector<std::chrono::steady_clock::time_point>>& attemptsMap,
            int maxAttempts
        );
        bool hasSuspiciousPatterns(const std::string& input);
        bool isDisposableEmail(const std::string& email);
        bool isCommonPassword(const std::string& password);

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