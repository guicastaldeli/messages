#include "input_sanitizer.h"
#include "suspicious_pattern_list.h"
#include <algorithm>
#include <cctype>
#include <locale>

std::string InputSanitizer::sanitizeInput(const std::string& input) {
    std::string sanitized = input;
    sanitized.erase(
        std::remove(
            sanitized.begin(), 
            sanitized.end(), 
            '\0'
        ), 
        sanitized.end()
    );
    sanitized.erase(
        sanitized.begin(), 
        std::find_if(
            sanitized.begin(), 
            sanitized.end(), 
            [](unsigned char ch) 
        {
            return !std::isspace(ch);
        }
    ));
    sanitized.erase(
        std::find_if(
            sanitized.rbegin(), 
            sanitized.rend(), 
            [](unsigned char ch) 
        {
            return !std::isspace(ch);
        }
    ).base(), sanitized.end());
    return sanitized;
}

bool InputSanitizer::containsSuspiciousPatterns(const std::string& input) {
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

bool InputSanitizer::hasSuspiciousPatterns(const std::string& input) {
    if(input.length() >= 3) {
        for(size_t i = 0; i < input.length() - 2; i++) {
            if(
                std::isalpha(input[i]) && 
                std::isalpha(input[i + 1]) &&
                std::isalpha(input[i + 2])
            ) {
                if(
                    (
                        input[i] + 1 == input[i + 1] && 
                        input[i + 1] + 1 == input[i + 2]
                    ) ||
                    (
                        input[i] - 1 == input[i + 1] && 
                        input[i + 1] - 1 == input[i + 2]
                    )
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