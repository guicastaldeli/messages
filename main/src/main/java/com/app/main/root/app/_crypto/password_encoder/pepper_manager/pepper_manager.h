#ifndef PEPPER_MANAGER_H
#define PEPPER_MANAGER_H

#include <vector>
#include <string>

class PepperManager {
private:
    std::vector<unsigned char> pepper;
    static const int PEPPER_LENGTH = 32;
    std::string filePath;

public:
    PepperManager();
    PepperManager(const std::string& path);
    ~PepperManager();
    
    void loadOrGeneratePepper();
    std::vector<unsigned char> getPepper() const;
    std::vector<unsigned char> applyPepper(const std::string& password) const;
    
private:
    void generateNewPepper(const std::string& fileName);
};

#endif