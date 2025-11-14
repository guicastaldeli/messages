#include "password_validator.h"
#include "common_password_list.h"
#include <algorithm>
#include <cctype>

bool PasswordValidator::isCommonPassword(const std::string& password) {
    std::string lowerPassword = password;
    std::transform(
        lowerPassword.begin(), 
        lowerPassword.end(), 
        lowerPassword.begin(), 
        ::tolower
    );
    return std::find(
        CommonPasswordList::LIST.begin(), 
        CommonPasswordList::LIST.end(), 
        lowerPassword
    ) != CommonPasswordList::LIST.end();
}

bool PasswordValidator::validate(const std::string& password) {
    if(!meetsLengthRequirements(password)) return false;
    return !isCommonPassword(password);
}

bool PasswordValidator::meetsLengthRequirements(const std::string& password) {
    return password.length() >= MIN_PASSWORD_LENGTH;
}