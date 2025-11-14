#ifndef RATE_LIMITER_H
#define RATE_LIMITER_H

#include <string>
#include <unordered_map>
#include <vector>
#include <chrono>
#include <mutex>

class RateLimiter {
private:
    static const long long RATE_LIMIT_WINDOW_MS = 3600000;
    std::unordered_map<std::string, std::vector<std::chrono::steady_clock::time_point>> registrationAttempts;
    std::unordered_map<std::string, std::vector<std::chrono::steady_clock::time_point>> loginAttempts;
    std::mutex rateLimitMutex;

public:
    static const int MAX_REGISTRATION_ATTEMPTS_PER_HOUR = 5;
    static const int MAX_LOGIN_ATTEMPTS_PER_HOUR = 10;

    void recordRegistrationAttempt(const std::string& ipAddress);
    void recordLoginAttempt(const std::string& ipAddress);
    bool isRegistrationRateLimited(const std::string& ipAddress);
    bool isLoginRateLimited(const std::string& ipAddress);
    bool hasSuspiciousActivity(const std::string& ipAddress);
    void clearRateLimit(const std::string& ipAddress);

private:
    void cleanOldAttempts(std::vector<std::chrono::steady_clock::time_point>& attempts);
    bool isRateLimited(
        const std::string& id,
        std::unordered_map<std::string, std::vector<std::chrono::steady_clock::time_point>>& attemptsMap,
        int maxAttempts
    );
};

#endif