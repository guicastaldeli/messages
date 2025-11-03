#include "user_validator.h"
#include "disposable_email_domains.h"
#include "common_password_list.h"
#include <iostream>
#include <vector>
#include <algorithm>
#include <cctype>
#include <locale>

UserValidator::UserValidator():
    emailRegex(R"(^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$)"),
    usernameRegex(R"(^[a-zA-Z0-9_]{3,50}$)"),
    passwordStrengthRegex(R"(^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$)")
{}

UserValidator::~UserValidator() {}

/*
** Email Format
*/
bool UserValidator::isValidEmailFormat(const std::string& email) {
    return std::regex_match(email, emailRegex);
}

/*
** Username Formar
*/
bool UserValidator::isValidUsernameFormat(const std::string& username) {
    return std::regex_match(username, usernameRegex);
}

/*
** Password Valid
*/
bool UserValidator::isPasswordValid(const std::string& password) {
    if(password.length() < MIN_PASSWORD_LENGTH) return false;
    std::string lowerPassword = password;
    std::transform(lowerPassword.begin(), lowerPassword.end(), lowerPassword.begin(), ::tolower);
    for(const auto& common : CommonPasswordList::LIST) {
        if(lowerPassword == common) {
            return false;
        }
    }

    return true;
}

/*
** Disposable Email
*/
bool UserValidator::isDisposableEmail(const std::string& email) {
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

/*
** Common Password
*/
bool UserValidator::isCommonPassword(const std::string& password) {
    std::string lowerPassword = password;
    std::transform(lowerPassword.begin(), lowerPassword.end(), lowerPassword.begin(), ::tolower);
    return std::find(
        CommonPasswordList::LIST.begin(), 
        CommonPasswordList::LIST.end(), 
        lowerPassword
    ) != CommonPasswordList::LIST.end();
}


