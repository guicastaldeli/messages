#ifndef INPUT_SANITIZER_H
#define INPUT_SANITIZER_H

#include <string>

class InputSanitizer {
public:
    static std::string sanitizeInput(const std::string& input);
    static bool containsSuspiciousPatterns(const std::string& input);
    static bool hasSuspiciousPatterns(const std::string& input);
};

#endif