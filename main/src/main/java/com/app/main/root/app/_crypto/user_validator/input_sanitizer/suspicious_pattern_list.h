#ifndef SUSPICIOUS_PATTERN_LIST_H
#define SUSPICIOUS_PATTERN_LIST_H

#include <iostream>
#include <vector>
#include <algorithm>
#include <cctype>
#include <locale>

class SuspiciousPatternList {
    public: static inline const std::vector<std::string> LIST = {
        "<script", 
        "javascript:", 
        "onload=", 
        "onerror=", 
        "onclick=",
        "eval(", 
        "exec(", 
        "union select", 
        "drop table", 
        "insert into",
        "1=1", 
        "or 1=1",
        "--", 
        "/*", 
        "*/", 
        "waitfor delay"
    };
};

#endif