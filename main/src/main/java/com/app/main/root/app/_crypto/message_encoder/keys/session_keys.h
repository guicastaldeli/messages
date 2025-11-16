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
    std::map<uint32_t, std::vector<unsigned char>> skippedMessageKeys;
    std::map<uint32_t, std::vector<unsigned char>> decryptedMessageKeys;
    std::vector<unsigned char> serialize() const;
    static SessionKeys deserialize(const std::vector<unsigned char>& data);
};

class SessionManager {
private:
    std::map<std::string, SessionKeys> sessions;
    std::string storagePath;

public:
    SessionManager();
    SessionManager(const std::string& storagePath);
    
    bool hasSession(const std::string& participantId);
    SessionKeys& getSession(const std::string& participantId);
    void createSession(
        const std::string& participantId, 
        const SessionKeys& keys
    );
    void removeSession(const std::string& participantId);

    bool saveSessions();
    bool loadSessions();
    std::string getStoragePath() const {
        return storagePath;
    }
};

#endif