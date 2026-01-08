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
        if(result.getRenderConfig() == null) result.setRenderConfig(new HashMap<>());
        if(result.getMetadata() == null) result.setMetadata(new HashMap<>());

        String chatId = (String) data.get("chatId");
        String messageUsername = (String) data.get("username");
        String chatType = (String) data.get("chatType");
        String messageType = (String) data.get("type");
        
        boolean isGroup = 
            "GROUP".equals(chatType) ||
            "GROUP".equals(messageType) ||
            data.containsKey("groupId") || 
            (chatId != null && chatId.startsWith("group_"));
        boolean isSystem = isSystemMessage(data);
        boolean isSelf = isSelfMessage(sessionId, data);
        String displayUsername = determineDisplayUsername(isSelf, isGroup, messageUsername);

        if(isSystem) {
            if(isSelf) {
                return serviceManager.getSystemMessageService().createPerspective(result, data, sessionId);
            } else {
                return serviceManager.getMessageService().createSelfPerspective(result, isGroup, displayUsername, sessionId);
            }
        } 
        if(isSelf) {
            return serviceManager.getMessageService().createSelfPerspective(result, isGroup, displayUsername, sessionId);
        } else {
            return serviceManager.getMessageService().createOtherPerspective(result, isGroup, displayUsername, sessionId);
        }
    }

    public boolean isAboutCurrentUser(
        Map<String, Object> data,
        String sessionId
    ) {
        String userId = (String) data.get("userId");
        String currentUserId = serviceManager.getUserService().getUserIdBySession(sessionId);
        
        return (currentUserId != null && currentUserId.equals(userId)) ||
                Boolean.TRUE.equals(data.get("isAboutCurrentUser"));
    }

    public boolean isInviterCurrentUser(Map<String, Object> data, String targetSessionId) {
        try {
            String inviterUserId = (String) data.get("inviterUserId");
            String currentUserId = serviceManager.getUserService().getUserIdBySession(targetSessionId);
            return currentUserId != null && currentUserId.equals(inviterUserId);
        } catch(Exception err) {
            err.printStackTrace();
            return false;
        }
    }

    /**
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

    /**
     * 
     * System
     * 
     */
    private boolean isSystemMessage(Map<String, Object> data) {
        String type = (String) data.get("type");
        String messageType = (String) data.get("messageType");

        return "SYSTEM".equals(type) ||
            "SYSTEM_MESSAGE".equals(messageType) ||
            (data.containsKey("isSystem")) && 
            Boolean.TRUE.equals(data.get("isSystem"));
    }

    /**
     * 
     * Regular
     * 
     */
    private boolean isSelfMessage(String sessionId, Map<String, Object> data) {
        String senderId = (String) data.get("userId");
        String currentUserId = serviceManager.getUserService().getUserIdBySession(sessionId);
        boolean result = false;
        
        if(currentUserId != null && currentUserId.equals(senderId)) {
            result = true;
        }
        return result;
    }
}
