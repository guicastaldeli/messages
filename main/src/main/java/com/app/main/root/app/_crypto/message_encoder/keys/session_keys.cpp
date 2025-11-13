#include "session_keys.h"
#include <stdexcept>

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
}

void SessionManager::removeSession(const std::string& participantId) {
    sessions.erase(participantId);
}