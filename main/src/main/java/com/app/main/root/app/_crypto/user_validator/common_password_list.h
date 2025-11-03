#ifndef COMMON_PASSWORD_LIST_H
#define COMMON_PASSWORD_LIST_H

#include <iostream>
#include <vector>
#include <algorithm>
#include <cctype>
#include <locale>

class CommonPasswordList {
    public: static inline const std::vector<std::string> LIST = {
        "password", 
        "123456", 
        "12345678", 
        "123456789", 
        "qwerty",
        "abc123", 
        "password1",
        "password2",
        "12345", 
        "1234567", 
        "111111",
        "1234567890", 
        "admin", 
        "welcome"
    };
};

#endif