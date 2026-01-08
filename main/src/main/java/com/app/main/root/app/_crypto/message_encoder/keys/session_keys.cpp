#include "session_keys.h"
#include <stdexcept>
#include <fstream>
#include <iostream>
#include <sstream>
#include <iomanip>

std::string bytesToHex(const std::vector<unsigned char>& data) {
    std::stringstream ss;
    for(unsigned char byte : data) {
        ss << std::hex << std::setw(2) << std::setfill('0') << (int)byte;
    }
    return ss.str();
}

std::vector<unsigned char> hexToBytes(const std::string& hex) {
    std::vector<unsigned char> bytes;
    for(size_t i = 0; i < hex.length(); i += 2) {
        std::string byteString = hex.substr(i, 2);
        unsigned char byte = (unsigned char)strtol(byteString.c_str(), nullptr, 16);
        bytes.push_back(byte);
    }
    return bytes;
}

/**
 * Serialize
 */
std::vector<unsigned char> SessionKeys::serialize() const {
    std::vector<unsigned char> data;

    uint32_t rootKeySize = rootKey.size();
    data.insert(
        data.end(),
        reinterpret_cast<unsigned char*>(&rootKeySize),
        reinterpret_cast<unsigned char*>(&rootKeySize) + sizeof(rootKeySize)
    );
    data.insert(data.end(), rootKey.begin(), rootKey.end());

    uint32_t chainKeySendSize = chainKeySend.size();
    data.insert(
        data.end(),
        reinterpret_cast<unsigned char*>(&chainKeySendSize),
        reinterpret_cast<unsigned char*>(&chainKeySendSize) + sizeof(chainKeySendSize)
    );
    data.insert(data.end(), chainKeySend.begin(), chainKeySend.end());

    uint32_t chainKeyReceiveSize = chainKeyReceive.size();
    data.insert(
        data.end(),
        reinterpret_cast<unsigned char*>(&chainKeyReceiveSize),
        reinterpret_cast<unsigned char*>(&chainKeyReceiveSize) + sizeof(chainKeyReceiveSize)
    );
    data.insert(data.end(), chainKeyReceive.begin(), chainKeyReceive.end());

    data.insert(
        data.end(),
        reinterpret_cast<const unsigned char*>(&messageCountSend),
        reinterpret_cast<const unsigned char*>(&messageCountSend) + sizeof(messageCountSend)
    );
    data.insert(
        data.end(),
        reinterpret_cast<const unsigned char*>(&messageCountReceive),
        reinterpret_cast<const unsigned char*>(&messageCountReceive) + sizeof(messageCountReceive)
    );

    uint32_t skippedKeysCount = skippedMessageKeys.size();
    data.insert(
        data.end(),
        reinterpret_cast<const unsigned char*>(&skippedKeysCount),
        reinterpret_cast<const unsigned char*>(&skippedKeysCount) + sizeof(skippedKeysCount)
    );
    for(const auto& pair : skippedMessageKeys) {
        uint32_t keyId = pair.first;
        data.insert(
            data.end(),
            reinterpret_cast<const unsigned char*>(&keyId),
            reinterpret_cast<const unsigned char*>(&keyId) + sizeof(keyId)
        );

        uint32_t keySize = pair.second.size();
        data.insert(
            data.end(),
            reinterpret_cast<const unsigned char*>(&keySize),
            reinterpret_cast<const unsigned char*>(&keySize) + sizeof(keySize)
        );
        data.insert(data.end(), pair.second.begin(), pair.second.end());
    }

    uint32_t decryptedKeysCount = decryptedMessageKeys.size();
    data.insert(
        data.end(),
        reinterpret_cast<const unsigned char*>(&decryptedKeysCount),
        reinterpret_cast<const unsigned char*>(&decryptedKeysCount) + sizeof(decryptedKeysCount)
    );

    for(const auto& pair : decryptedMessageKeys) {
        uint32_t keyId = pair.first;
        data.insert(
            data.end(),
            reinterpret_cast<const unsigned char*>(&keyId),
            reinterpret_cast<const unsigned char*>(&keyId) + sizeof(keyId)
        );

        uint32_t keySize = pair.second.size();
        data.insert(
            data.end(),
            reinterpret_cast<const unsigned char*>(&keySize),
            reinterpret_cast<const unsigned char*>(&keySize) + sizeof(keySize)
        );
        data.insert(data.end(), pair.second.begin(), pair.second.end());
    }

    return data;
}

/**
 * Deserialize
 */
SessionKeys SessionKeys::deserialize(const std::vector<unsigned char>& data) {
    SessionKeys session;
    size_t offset = 0;

    uint32_t rootKeySize;
    if(offset + sizeof(rootKeySize) > data.size()) throw std::runtime_error("Invalid session data");
    std::copy(
        data.begin() + offset, 
        data.begin() + offset + sizeof(rootKeySize), 
        reinterpret_cast<unsigned char*>(&rootKeySize)
    );
    offset += sizeof(rootKeySize);
    if(offset + rootKeySize > data.size()) throw std::runtime_error("Invalid root key size");
    session.rootKey.assign(
        data.begin() + offset, 
        data.begin() + offset + rootKeySize
    );
    offset += rootKeySize;

    uint32_t chainKeySendSize;
    if(offset + sizeof(chainKeySendSize) > data.size()) throw std::runtime_error("Invalid session data");
    std::copy(
        data.begin() + offset,
        data.begin() + offset + sizeof(chainKeySendSize),
        reinterpret_cast<unsigned char*>(&chainKeySendSize)
    );
    offset += sizeof(chainKeySendSize);
    if(offset + chainKeySendSize > data.size()) throw std::runtime_error("Invalid chain key size");
    session.chainKeySend.assign(
        data.begin() + offset,
        data.begin() + offset + chainKeySendSize
    );
    offset += chainKeySendSize;

    uint32_t chainKeyReceiveSize;
    if(offset + sizeof(chainKeyReceiveSize) > data.size()) throw std::runtime_error("Invalid session data");
    std::copy(
        data.begin() + offset,
        data.begin() + offset + sizeof(chainKeyReceiveSize),
        reinterpret_cast<unsigned char*>(&chainKeyReceiveSize)
    );
    offset += sizeof(chainKeyReceiveSize);
    if(offset + chainKeyReceiveSize > data.size()) throw std::runtime_error("Invalid chain key receive size");
    session.chainKeyReceive.assign(
        data.begin() + offset,
        data.begin() + offset + chainKeyReceiveSize
    );
    offset += chainKeyReceiveSize;

    std::copy(
        data.begin() + offset,
        data.begin() + offset + sizeof(session.messageCountSend),
        reinterpret_cast<unsigned char*>(&session.messageCountSend)
    );
    offset += sizeof(session.messageCountSend);

    std::copy(
        data.begin() + offset,
        data.begin() + offset + sizeof(session.messageCountReceive),
        reinterpret_cast<unsigned char*>(&session.messageCountReceive)
    );
    offset += sizeof(session.messageCountReceive);
    
    uint32_t skippedKeysCount;
    if(offset + sizeof(skippedKeysCount) > data.size()) {
        return session;
    }
    std::copy(
        data.begin() + offset,
        data.begin() + offset + sizeof(skippedKeysCount),
        reinterpret_cast<unsigned char*>(&skippedKeysCount)
    );
    offset += sizeof(skippedKeysCount);
    for(uint32_t i = 0; i < skippedKeysCount; i++) {
        uint32_t keyId;
        if(offset + sizeof(keyId) > data.size()) break;
        std::copy(
            data.begin() + offset,
            data.begin() + offset + sizeof(keyId),
            reinterpret_cast<unsigned char*>(&keyId)
        );
        offset += sizeof(keyId);

        uint32_t keySize;
        if(offset + sizeof(keySize) > data.size()) break;
        std::copy(
            data.begin() + offset,
            data.begin() + offset + sizeof(keySize),
            reinterpret_cast<unsigned char*>(&keySize)
        );
        offset += sizeof(keySize);

        if(offset + keySize > data.size()) break;
        std::vector<unsigned char> key(keySize);
        std::copy(
            data.begin() + offset,
            data.begin() + offset + keySize,
            key.begin()
        );
        offset += keySize;
        session.skippedMessageKeys[keyId] = key;
    }

    uint32_t decryptedKeysCount = 0;
    if(offset + sizeof(decryptedKeysCount) <= data.size()) {
        std::copy(
            data.begin() + offset,
            data.begin() + offset + sizeof(decryptedKeysCount),
            reinterpret_cast<unsigned char*>(&decryptedKeysCount)
        );
        offset += sizeof(decryptedKeysCount);

        for(uint32_t i = 0; i < decryptedKeysCount; i++) {
            if(offset + sizeof(uint32_t) > data.size()) break;
            
            uint32_t keyId;
            std::copy(
                data.begin() + offset,
                data.begin() + offset + sizeof(keyId),
                reinterpret_cast<unsigned char*>(&keyId)
            );
            offset += sizeof(keyId);
            if(offset + sizeof(uint32_t) > data.size()) break;
            
            uint32_t keySize;
            std::copy(
                data.begin() + offset,
                data.begin() + offset + sizeof(keySize),
                reinterpret_cast<unsigned char*>(&keySize)
            );
            offset += sizeof(keySize);
            if(offset + keySize > data.size()) break;
            
            std::vector<unsigned char> key(keySize);
            std::copy(
                data.begin() + offset,
                data.begin() + offset + keySize,
                key.begin()
            );
            offset += keySize;

            session.decryptedMessageKeys[keyId] = key;
        }
    }

    return session;
}

SessionManager::SessionManager() : 
    storagePath("src/main/java/com/app/main/root/app/_crypto/message_encoder/keys/session-keys.dat") 
{
    loadSessions();
}
SessionManager::SessionManager(const std::string& storagePath) : storagePath(storagePath) {
    loadSessions();
}

/**
 * Save Session
 */
bool SessionManager::saveSessions() {
    try {
        std::ofstream file(storagePath, std::ios::binary);
        if(!file) {
            std::cerr << "Failed to open session file: " << storagePath << std::endl;
            return false;
        }

        uint32_t sessionCount = sessions.size();
        file.write(
            reinterpret_cast<const char*>(&sessionCount),
            sizeof(sessionCount)
        );

        for(const auto& pair : sessions) {
            uint32_t idLength = pair.first.length();
            file.write(
                reinterpret_cast<const char*>(&idLength),
                sizeof(idLength)
            );
            file.write(
                pair.first.c_str(), 
                idLength
            );

            auto sessionData = pair.second.serialize();
            uint32_t dataLength = sessionData.size();
            file.write(
                reinterpret_cast<const char*>(&dataLength),
                sizeof(dataLength)
            );
            file.write(
                reinterpret_cast<const char*>(sessionData.data()),
                dataLength
            );
        }

        file.close();
        //std::cout << "Saved " << sessions.size() << " sessions to " << storagePath << std::endl;
        return true;
    } catch(const std::exception& err) {
        std::cerr << "Failed to save sessions: " << err.what() << std::endl;
        return false;
    }
}

/**
 * Load Session
 */
bool SessionManager::loadSessions() {
    try {
        std::ifstream file(storagePath, std::ios::binary);
        if(!file) {
            std::cout << "No existing session file found: " << storagePath << std::endl;
            return false;
        }
        sessions.clear();

        uint32_t sessionCount;
        file.read(
            reinterpret_cast<char*>(&sessionCount),
            sizeof(sessionCount)
        );

        for(uint32_t i = 0; i < sessionCount; i++) {
            uint32_t idLength;
            file.read(
                reinterpret_cast<char*>(&idLength),
                sizeof(idLength)
            );

            std::string participantId(idLength, '\0');
            file.read(&participantId[0], idLength);

            uint32_t dataLength;
            file.read(
                reinterpret_cast<char*>(&dataLength),
                sizeof(dataLength)
            );

            std::vector<unsigned char> sessionData(dataLength);
            file.read(
                reinterpret_cast<char*>(sessionData.data()),
                dataLength
            );

            SessionKeys session = SessionKeys::deserialize(sessionData);
            sessions[participantId] = session;
        }

        file.close();
        std::cout << "Loaded " << sessions.size() << " sessions from " << storagePath << std::endl;
        return true;
    } catch(const std::exception& err) {
        std::cerr << "Failed to load sessions: " << err.what() << std::endl;
        sessions.clear();
        return false;
    }
}

bool SessionManager::hasSession(const std::string& participantId) {
    return sessions.find(participantId) != sessions.end();
}

SessionKeys& SessionManager::getSession(const std::string& participantId) {
    auto it = sessions.find(participantId);
    if(it == sessions.end()) {
        throw std::runtime_error("No session found for participant: " + participantId);
    }
    return it->second;
}

void SessionManager::createSession(
    const std::string& participantId, 
    const SessionKeys& keys
) {
    sessions[participantId] = keys;
    saveSessions();
}

void SessionManager::removeSession(const std::string& participantId) {
    sessions.erase(participantId);
    saveSessions();
}