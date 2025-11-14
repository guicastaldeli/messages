#include "password_validator.h"
#include <cctype>
#include <algorithm>

bool PasswordValidator::isPasswordStrong(const std::string& password) {
    if(!meetsLengthRequirement(password)) return false;
    
    int requirementsMet = 0;
    if(hasUpperCase(password)) requirementsMet++;
    if(hasLowerCase(password)) requirementsMet++;
    if(hasDigits(password)) requirementsMet++;
    if(hasSpecialChars(password)) requirementsMet++;
    return requirementsMet >= 3;
}

bool PasswordValidator::meetsLengthRequirement(const std::string& password, int minLength) {
    return password.length() >= minLength;
}

bool PasswordValidator::hasUpperCase(const std::string& password) {
    return std::any_of(password.begin(), password.end(), [](char c) {
        return std::isupper(c);
    });
}

bool PasswordValidator::hasLowerCase(const std::string& password) {
    return std::any_of(password.begin(), password.end(), [](char c) {
        return std::islower(c);
    });
}

bool PasswordValidator::hasDigits(const std::string& password) {
    return std::any_of(password.begin(), password.end(), [](char c) {
        return std::isdigit(c);
    });
}

bool PasswordValidator::hasSpecialChars(const std::string& password) {
    const std::string specialChars = "!@#$%^&*()_+-=[]{}|;:,.<>?";
    return std::any_of(password.begin(), password.end(), [&specialChars](char c) {
        return specialChars.find(c) != std::string::npos;
    });
}