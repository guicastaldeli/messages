package com.app.main.root.app._data;
import org.springframework.stereotype.Component;
import com.app.main.root.app._service.ServiceManager;
import java.util.*;

@Component
public class MessagePerspectiveDetector {
    private final ServiceManager serviceManager;

    public MessagePerspectiveDetector(ServiceManager serviceManager) {
        this.serviceManager = serviceManager;
    }

    public MessagePerspectiveResult detectPerspective(String sessionId, Map<String, Object> data) {
        MessagePerspectiveResult result = new MessagePerspectiveResult();
        String chatId = (String) data.get("chatId");
        String messageUsername = (String) data.get("username");
        String chatType = (String) data.get("chatType");
        String messageType = (String) data.get("type");
        String currentUsername = serviceManager.getUserService().getUsernameBySessionId(sessionId);
        
        boolean isSystem = isSystemMessage(data);
        boolean isSelf = isSelfMessage(sessionId, currentUsername, data);
        boolean isOther = !isSelf;
        boolean isGroup = 
            "GROUP".equals(chatType) ||
            "GROUP".equals(messageType) ||
            data.containsKey("groupId") || 
            (chatId != null && chatId.startsWith("group_"));

        String displayUsername = determineDisplayUsername(isSelf, isGroup, messageUsername);
        if(isSystem) {
            return serviceManager.getSystemMessageService().createPerspective(result, data, sessionId);
        }
        if(isSelf) {
            return serviceManager.getMessageService().createSelfPerspective(result, isGroup, displayUsername);
        }
        if(isOther) {
            return serviceManager.getMessageService().createOtherPerspective(result, isGroup, displayUsername);
        }

        return serviceManager.getMessageService().createOtherPerspective(result, isGroup, displayUsername);
    }

    public boolean isAboutCurrentUser(
        Map<String, Object> data,
        String sessionId
    ) {
        String userId = (String) data.get("userId");
        String username = (String) data.get("username");
        String currentUsername = serviceManager.getUserService().getUsernameBySessionId(sessionId);
        String currentUserId = serviceManager.getUserService().getUserIdBySession(sessionId);
        
        return (currentUserId != null && currentUserId.equals(userId)) ||
                (currentUsername != null && currentUsername.equals(username)) ||
                Boolean.TRUE.equals(data.get("isAboutCurrentUser"));
    }

    /*
    * Display Username 
    */
    private String determineDisplayUsername(
        boolean isSelf,
        boolean isGroup,
        String messageUsername
    ) {
        if(isSelf) {
            return null;
        } else {
            return isGroup ? messageUsername : null;
        }
    }

    /*
    **
    *** System
    **
    */
    private boolean isSystemMessage(Map<String, Object> data) {
        String type = (String) data.get("type");
        String messageType = (String) data.get("messageType");

        return "SYSTEM".equals(type) ||
            "SYSTEM_MESSAGE".equals(messageType) ||
            (data.containsKey("isSystem")) && 
            Boolean.TRUE.equals(data.get("isSystem"));
    }

    /*
    **
    *** Normal
    **
    */
    private boolean isSelfMessage(
        String sessionId,
        String currentUsername,
        Map<String, Object> data
    ) {
        String senderId = (String) data.get("senderId");
        String username = (String) data.get("username");
        return sessionId.equals(senderId) ||
            currentUsername.equals(username) ||
            Boolean.TRUE.equals(data.get("isSelf")) ||
            Boolean.TRUE.equals(data.get("isSelfMessage"));
    }
}
