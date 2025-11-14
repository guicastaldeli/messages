#ifndef DISPOSABLE_EMAIL_DOMAINS_H
#define DISPOSABLE_EMAIL_DOMAINS_H

#include <iostream>
#include <vector>
#include <algorithm>
#include <cctype>
#include <locale>

class DisposableEmailDomains {
    public: static inline const std::vector<std::string> LIST = {
        "tempmail.com", 
        "guerrillamail.com", 
        "mailinator.com", 
        "10minutemail.com",
        "throwawaymail.com", 
        "yopmail.com", 
        "fakeinbox.com", 
        "trashmail.com",
        "temp-mail.org", 
        "getairmail.com", 
        "sharklasers.com", 
        "grr.la"
    };
};

#endif