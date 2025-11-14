#include "rate_limiter.h"
#include <algorithm>

void RateLimiter::recordRegistrationAttempt(const std::string& ipAddress) {
    std::lock_guard<std::mutex> lock(rateLimitMutex);
    auto& attempts = registrationAttempts[ipAddress];
    attempts.push_back(std::chrono::steady_clock::now());
    cleanOldAttempts(attempts);
}

void RateLimiter::recordLoginAttempt(const std::string& ipAddress) {
    std::lock_guard<std::mutex> lock(rateLimitMutex);
    auto& attempts = loginAttempts[ipAddress];
    attempts.push_back(std::chrono::steady_clock::now());
    cleanOldAttempts(attempts);
}

bool RateLimiter::isRegistrationRateLimited(const std::string& ipAddress) {
    return isRateLimited(ipAddress, registrationAttempts, MAX_REGISTRATION_ATTEMPTS_PER_HOUR);
}

bool RateLimiter::isLoginRateLimited(const std::string& ipAddress) {
    return isRateLimited(ipAddress, loginAttempts, MAX_LOGIN_ATTEMPTS_PER_HOUR);
}

bool RateLimiter::hasSuspiciousActivity(const std::string& ipAddress) {
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

void RateLimiter::clearRateLimit(const std::string& ipAddress) {
    std::lock_guard<std::mutex> lock(rateLimitMutex);
    registrationAttempts.erase(ipAddress);
    loginAttempts.erase(ipAddress);
}

void RateLimiter::cleanOldAttempts(std::vector<std::chrono::steady_clock::time_point>& attempts) {
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

bool RateLimiter::isRateLimited(
    const std::string& id,
    std::unordered_map<std::string, std::vector<std::chrono::steady_clock::time_point>>& attemptsMap,
    int maxAttempts
) {
    std::lock_guard<std::mutex> lock(rateLimitMutex);
    auto& attempts = attemptsMap[id];
    cleanOldAttempts(attempts);
    return attempts.size() >= maxAttempts;
}