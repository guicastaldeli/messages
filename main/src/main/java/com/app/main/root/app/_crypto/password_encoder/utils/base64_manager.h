#ifndef BASE64_MANAGER_H
#define BASE64_MANAGER_H

#include <vector>
#include <string>

class Base64Manager {
public:
    static std::string encode(const std::vector<unsigned char>& data);
    static std::vector<unsigned char> decode(const std::string& encoded_string);
    
private:
    static const std::string base64_chars;
    static bool is_base64(unsigned char c);
};

#endif