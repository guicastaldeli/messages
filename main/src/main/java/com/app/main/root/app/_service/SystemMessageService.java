package com.app.main.root.app._service;
import org.springframework.context.annotation.Lazy;
import org.springframework.stereotype.Component;
import com.app.main.root.app._data.CommandSystemMessageList;
import com.app.main.root.app._data.MessagePerspectiveDetector;
import com.app.main.root.app._data.MessagePerspectiveResult;
import java.util.*;

@Component
public class SystemMessageService {
    private final ServiceManager serviceManager;
    private final MessagePerspectiveDetector messagePerspectiveDetector;

    public SystemMessageService(
        @Lazy ServiceManager serviceManager,
        @Lazy MessagePerspectiveDetector messagePerspectiveDetector
    ) {
        this.serviceManager = serviceManager;
        this.messagePerspectiveDetector = messagePerspectiveDetector;
    }

    /*
    * Get Template
    */
    private String getTemplate(String eventType) {
        try {
            CommandSystemMessageList message = CommandSystemMessageList.valueOf(eventType);
            return message.get();
        } catch(IllegalArgumentException err) {
            System.err.println("TEMPLATE ERR:" + err);
            return "System event ***";
        }
    }

    /*
    * Set Content
    */
    public String setContent(
        String template,
        Map<String, Object> data,
        String currentSesionId,
        String targetSessionId
    ) {
        String username = (String) data.get("username");
        String groupName = (String) data.get("groupName");
        String content = template;
        boolean isAboutCurrentUser = messagePerspectiveDetector.isAboutCurrentUser(data, targetSessionId);
        String finalUsername = username != null ? username : "Unknown";

        if(isAboutCurrentUser) {
            content = content.replace("{username}", "You");
        } else {
            content = content.replace("{username}", finalUsername);
        }

        if(groupName != null) content = content.replace("{group}", groupName);
        return content;
    }

    /*
    * Create Message 
    */
    public Map<String, Object> createMessage(
        String eventType,
        Map<String, Object> data,
        String currentSessionId,
        String targetSessionId
    ) {
        long time = System.currentTimeMillis();
        String template = getTemplate(eventType);
        String content = setContent(
            template,
            data,
            currentSessionId,
            targetSessionId
        );

        Map<String, Object> systemMessage = new HashMap<>();
        systemMessage.put("type", "SYSTEM");
        systemMessage.put("messageType", eventType);
        systemMessage.put("event", eventType);
        systemMessage.put("content", content);
        systemMessage.put("timestamp", time);
        systemMessage.put("isSystem", true);
        systemMessage.put("originalData", data);
        return systemMessage;
    }

    public Map<String, Object> createMessageWithPerspective(
        String eventType,
        Map<String, Object> data,
        String currentSessionId,
        String targetSessionId
    ) {
        Map<String, Object> message = createMessage(eventType, data, currentSessionId, targetSessionId);
        MessagePerspectiveResult perspective = messagePerspectiveDetector.detectPerspective(targetSessionId, message);
        message.put("_perspective", createPerspectiveMap(perspective));
        message.put("_metadata", createMetadata(perspective));
        return message;
    }

    /*
    * Payload 
    */
    public Map<String, Object> payload(
        String type, 
        Map<String, Object> payload,
        String chatId,
        String sessionId
    ) { 
        Map<String, Object> message = new HashMap<>();
        message.put("username", payload.get("username"));
        message.put("content", payload.get("content"));
        message.put("senderId", payload.get("senderId"));
        message.put("chatId", chatId);
        message.put("groupId", chatId);
        message.put("messageId", payload.get("messageId"));
        message.put("timestamp", payload.get("timestamp"));
        message.put("type", "SYSTEM_MESSAGE");
        message.put("event", payload.get("eventType"));
        message.put("isDirect", false);
        message.put("isGroup", true);
        message.put("isSystem", true);
        message.put("isBroadcast", false);
        return message;
    }

    /*
    **
    ***
    *** Perpspective
    ***
    **
    */
    private Map<String, Object> createPerspectiveMap(MessagePerspectiveResult result) {
        Map<String, Object> map = new HashMap<>();
        map.put("direction", result.getDirection());
        map.put("perspectiveType", result.getPerpspectiveType());
        map.put("renderConfig", result.getRenderConfig());
        map.put("metadata", result.getMetadata());
        return map;
    }

    private Map<String, Object> createMetadata(MessagePerspectiveResult result) {
        Map<String, Object> metadata = new HashMap<>();
        metadata.put("direction", result.getDirection());
        metadata.put("perspectiveType", result.getPerpspectiveType());
        metadata.put("isSystem", true);
        metadata.put("isAboutCurrentUser", result.getMetadata().get("isAboutCurentUser"));
        return metadata;
    }

    public MessagePerspectiveResult createPerspective(
        MessagePerspectiveResult result,
        Map<String, Object> data,
        String sessionId
    ) {
        result.setDirection("system");
        result.setPerpspectiveType("SYSTEM_MESSAGE");
        
        boolean isAboutCurrentUser = messagePerspectiveDetector.isAboutCurrentUser(data, sessionId);

        result.getRenderConfig().put("showUsername", false);
        result.getRenderConfig().put("displayUsername", null);
        result.getRenderConfig().put("showAvatar", false);
        result.getRenderConfig().put("alignment", "center");
        result.getRenderConfig().put("componentType", "system");
        result.getRenderConfig().put("isAboutCurrentUser", isAboutCurrentUser);

        result.getMetadata().put("isCurrentUser", false);
        result.getMetadata().put("isGroup", false);
        result.getMetadata().put("isDirect", false);
        result.getMetadata().put("isSystem", true);
        result.getMetadata().put("isAboutCurrentUser", isAboutCurrentUser);

        return result;
    }
}