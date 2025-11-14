#include "email_validator.h"
#include "disposable_email_domains.h"
#include <algorithm>
#include <cctype>

EmailValidator::EmailValidator() : 
    emailRegex(R"(^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$)") 
{}

bool EmailValidator::isValidFormat(const std::string& email) {
    return std::regex_match(email, emailRegex);
}

bool EmailValidator::isDisposableEmail(const std::string& email) {
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

bool EmailValidator::validate(const std::string& email) {
    if(!meetsLengthRequirements(email)) return false;
    if(email.empty()) return false;
    if(!isValidFormat(email)) return false;
    return !isDisposableEmail(email);
}

bool EmailValidator::meetsLengthRequirements(const std::string& email) {
    return email.length() <= MAX_EMAIL_LENGTH;
}