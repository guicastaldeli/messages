#ifndef HASH_GENERATOR_H
#define HASH_GENERATOR_H

#include <vector>
#include <string>

class HashGenerator {
private:
    static const int HASH_KEY_LENGTH = 128;
    static const int HASH_ITERATIONS = 1000;

public:
    static std::vector<unsigned char> generateSecureHash(
        const std::vector<unsigned char>& pepperedPassword,
        const std::vector<unsigned char>& salt
    );
    
    static std::vector<unsigned char> applyMemoryHardFunction(
        const std::vector<unsigned char>& input,
        const std::vector<unsigned char>& salt
    );
    
    static std::vector<unsigned char> applyFinalHmac(
        const std::vector<unsigned char>& input,
        const std::vector<unsigned char>& salt
    );
    
    static bool constantTimeEquals(
        const std::vector<unsigned char>& a,
        const std::vector<unsigned char>& b
    );
};

#endif