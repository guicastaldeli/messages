#ifndef RESERVED_USERNAME_LIST_H
#define RESERVED_USERNAME_LIST_H

#include <iostream>
#include <vector>
#include <algorithm>
#include <cctype>
#include <locale>

class ReservedUsernameList {
    public: static inline const std::vector<std::string> LIST = {
        "admin", 
        "root", 
        "system", 
        "administrator", 
        "null", 
        "undefined"
    };
};

#endif