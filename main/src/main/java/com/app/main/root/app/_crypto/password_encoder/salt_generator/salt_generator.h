#ifndef SALT_GENERATOR_H
#define SALT_GENERATOR_H

#include <vector>

class SaltGenerator {
private:
    static const int SALT_LENGTH = 32;

public:
    static std::vector<unsigned char> generateSalt();
    static bool isSaltValid(const std::vector<unsigned char>& salt);
};

#endif