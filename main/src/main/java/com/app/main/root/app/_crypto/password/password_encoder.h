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
        static const int HASH_KEY_LENGTH = 128;
        static const int HASH_ITERATIONS = 1000;
        static const int MEMORY_COST = 128 * 128;
        std::vector<unsigned char> pepper;
        
        std::vector<unsigned char> generateSalt();
        std::vector<unsigned char> applyPepper(const std::string& password);
        void generateNewPepper(const std::string& fileName);
        std::vector<unsigned char> generateSecureHash(
            const std::vector<unsigned char>& pepperedPassword,
            const std::vector<unsigned char>& salt
        );
        std::vector<unsigned char> applyMemoryHardFunction(
            const std::vector<unsigned char>& input,
            const std::vector<unsigned char>& salt
        );
        std::vector<unsigned char> applyFinalHmac(
            const std::vector<unsigned char>& input,
            const std::vector<unsigned char>& salt
        );
        bool constantTimeEquals(
            const std::vector<unsigned char>& a,
            const std::vector<unsigned char>& b
        );
        std::string base64Encode(const std::vector<unsigned char>& data);
        std::vector<unsigned char> base64Decode(const std::string& encoded_string);

    public:
        PasswordEncoder();
        ~PasswordEncoder();

        std::string encode(const std::string& password);
        bool matches(
            const std::string& password,
            const std::string& encodedPassword
        );
        bool isPasswordStrong(const std::string& password);
        std:: string generateSecurePassword(int length);
};

#endif