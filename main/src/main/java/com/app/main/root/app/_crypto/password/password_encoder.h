#ifndef PASSWORD_ENCODER_H
#define PASSWORD_ENCODER_H

#include <jni.h>
#include <string>
#include <vector>
#include <openssl/evp.h>
#include <openssl/rand.h>
#include <openssl/hmac.h>

class PasswordEncoder {
    private:
        static const int SALT_LENGTH = 32;
        static const int HASH_INTERATIONS = 210000;
        static const int HASH_KEY_LENGTH = 256;
        static const int MEMORY_COST = 65536;

        std::vector<unsigned char> pepper;
        std::vector<unsigned char> generateSalt();
        std::vector<unsigned char> applyPepper(const std::string& password);
        std::vector<unsigned char> generateSecureHash(
            const std::vector<unsigned char>& pepperedPassword,
            const std::vector<unsigned char>& salt
        );
        std::vector<unsigned char> applyMemoryHardFunction(
            const std::vector<unsigned char>& input,
            const std::vector<unsigned char>& salt
        );
        bool constantTimeEquals(
            const std::vector<unsigned char>& a,
            const std::vector<unsigned char>& b
        );

    public:
        PasswordEncoder();
        ~PasswordEncoder();

        std::streing encode(const std::string& password);
        bool matches(
            const std::string& password,
            const std::string& encodedPassword,
        );
        std:: string generateSecurePassword(int length);
}

#endif