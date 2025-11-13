#ifndef BASE64_MANAGER_H
#define BASE64_MANAGER_H

#include <vector>
#include <string>

class Base64Manager {
public:
    static std::string base64Encode(const std::vector<unsigned char>& data);
    static std::vector<unsigned char> base64Decode(const std::string& encoded);
};

#endif