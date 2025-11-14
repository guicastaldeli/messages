#include "salt_generator.h"
#include <openssl/rand.h>
#include <stdexcept>

std::vector<unsigned char> SaltGenerator::generateSalt() {
    std::vector<unsigned char> salt(SALT_LENGTH);
    if(RAND_bytes(salt.data(), salt.size()) != 1) {
        throw std::runtime_error("Failed to generate salt");
    }
    return salt;
}

bool SaltGenerator::isSaltValid(const std::vector<unsigned char>& salt) {
    return salt.size() == SALT_LENGTH;
}