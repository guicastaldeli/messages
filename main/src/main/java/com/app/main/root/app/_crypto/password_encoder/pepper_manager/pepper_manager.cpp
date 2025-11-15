#include "pepper_manager.h"
#include "../utils/crypto_generator.h"
#include <openssl/rand.h>
#include <openssl/hmac.h>
#include <openssl/evp.h>
#include <fstream>
#include <iostream>
#include <stdexcept>

PepperManager::PepperManager() : filePath("src/main/java/com/app/main/root/app/_crypto/password_encoder/pepper_manager/pepper.bin") {
    pepper.resize(PEPPER_LENGTH);
    loadOrGeneratePepper();
}
PepperManager::PepperManager(const std::string& path) : filePath(path) {
    pepper.resize(PEPPER_LENGTH);
    loadOrGeneratePepper();
}
PepperManager::~PepperManager() {
    std::fill(pepper.begin(), pepper.end(), 0);
}

void PepperManager::loadOrGeneratePepper() {
    std::ifstream file(filePath, std::ios::binary);
    if(file && file.good()) {
        file.read(reinterpret_cast<char*>(pepper.data()), pepper.size());
        if(file.gcount() != PEPPER_LENGTH) {
            std::cerr << "Warning: Pepper file corrupted, generating new one" << std::endl;
            generateNewPepper(filePath);
        } else {
            std::cout << "Loading pepper from file" << std::endl;
        }
    } else {
        generateNewPepper(filePath);
    }
}

void PepperManager::generateNewPepper(const std::string& fileName) {
    if(RAND_bytes(pepper.data(), pepper.size()) != 1) {
        throw std::runtime_error("Failed to generate pepper");
    }

    std::ofstream outFile(fileName, std::ios::binary);
    if(outFile) {
        outFile.write(reinterpret_cast<const char*>(pepper.data()), pepper.size());
        std::cout << "Generated and saved new pepper" << std::endl;
    } else {
        std::cerr << "Warning: Could not save pepper to file" << std::endl;
    }
}

std::vector<unsigned char> PepperManager::getPepper() const {
    return pepper;
}

std::vector<unsigned char> PepperManager::applyPepper(const std::string& password) const {
    std::vector<unsigned char> result(EVP_MAX_MD_SIZE);
    unsigned int resultLen = 0;

    const EVP_MD* md = EVP_sha512();
    HMAC(
        md,
        pepper.data(),
        pepper.size(),
        reinterpret_cast<const unsigned char*>(password.data()),
        password.size(),
        result.data(),
        &resultLen
    );
    result.resize(resultLen);
    return result;
}