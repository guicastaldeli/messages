#ifndef SESSION_KEYS_H
#define SESSION_KEYS_H

#include <vector>
#include <cstdint>
#include <string>
#include <map>

struct SessionKeys {
    std::vector<unsigned char> rootKey;
    std::vector<unsigned char> chainKeySend;
    std::vector<unsigned char> chainKeyReceive;
    uint32_t messageCountSend;
    uint32_t messageCountReceive;
};

class SessionManager {
private:
    std::map<std::string, SessionKeys> sessions;

public:
    bool hasSession(const std::string& participantId);
    SessionKeys& getSession(const std::string& participantId);
    void createSession(
        const std::string& participantId, 
        const SessionKeys& keys
    );
    void removeSession(const std::string& participantId);
};

#endif