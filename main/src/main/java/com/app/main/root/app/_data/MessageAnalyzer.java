package com.app.main.root.app._data;
import com.app.main.root.app.EventTracker;
import com.app.main.root.app.EventLog.EventDirection;
import com.app.main.root.app._server.MessageRouter;
import com.app.main.root.app._service.ServiceManager;
import org.springframework.stereotype.Component;
import java.util.*;

@Component
public class MessageAnalyzer {
    private final ServiceManager serviceManager;
    private final EventTracker eventTracker;
    private final MessageRouter messageRouter;

    public MessageAnalyzer(
        ServiceManager serviceManager,
        EventTracker eventTracker,
        MessageRouter messageRouter
    ) {
        this.serviceManager = serviceManager;
        this.eventTracker = eventTracker;
        this.messageRouter = messageRouter;
    }

    /*
    * Orginze and Route 
    */
    public void organizeAndRoute(String sessionId, Map<String, Object> payload) {
        MessageContext context = analyzeContext(sessionId, payload);
        String[] routes = determineRoutes(context);
        Map<String, Object> setMessage = setMessage(context);
        
        routeMessage(context, setMessage, routes);
        trackMessage(context);
    }

    /*
    * Analyze 
    */
    private MessageContext analyzeContext(String sessionId, Map<String, Object> payload) {
        String content = (String) payload.get("content");
        String messageId = (String) payload.get("messageId");
        String chatId = (String) payload.get("chatId");
        String groupId = (String) payload.get("groupId");
        String targetUserId = (String) payload.get("targetUserId");
        String username = (String) payload.get("username");
        boolean isGroup = (chatId != null && chatId.startsWith("group_")) ||
                            (groupId != null) ||
                            "GROUP".equals(payload.get("type")) ||
                            "GROUP".equals(payload.get("chatType"));
        boolean isDirect = (targetUserId != null) && !isGroup;
        boolean isSystem = "SYSTEM_MESSAGE".equals(payload.get("type"));
        boolean isBoolean = (chatId == null && targetUserId == null);

        return new MessageContext(
            sessionId, 
            content,
            messageId,
            chatId,
            targetUserId, 
            username, 
            isDirect, 
            isGroup,
            isSystem,
            isBoolean
        );
    }

    /*
    * Set 
    */
    private Map<String, Object> setMessage(MessageContext context) {
        String messageId = context.messageId != null ? context.messageId : 
        "msg_" + System.currentTimeMillis() + "_" + UUID.randomUUID().toString().substring(0, 8);
        String type = getMessageType(context);
        long time = System.currentTimeMillis();

        Map<String, Object> message = new HashMap<>();
        message.put("username", context.username);
        message.put("content", context.content);
        message.put("senderId", context.sessionId);
        message.put("chatId", context.chatId);
        message.put("targetUserId", context.targetUserId);
        message.put("messageId", messageId);
        message.put("timestamp", time);
        message.put("type", type);
        message.put("isDirect", context.isDirect);
        message.put("isGroup", context.isGroup);
        message.put("isSystem", context.isSystem);
        message.put("isBroadcast", context.isBroadcast);

        Map<String, Object> routingMetadata = new HashMap<>();
        routingMetadata.put("sessionId", context.sessionId);
        routingMetadata.put("messageType", type);
        routingMetadata.put("messageId", messageId);
        routingMetadata.put("isDirect", context.isDirect);
        routingMetadata.put("isGroup", context.isGroup);
        routingMetadata.put("isBroadcast", context.isBroadcast);
        routingMetadata.put("priority", "NORMAL");
        message.put("routingMetadata", routingMetadata);

        return message;
    }

    /*
    * Type 
    */
    public String getMessageType(MessageContext context) {
        if(context.isDirect) return "DIRECT_MESSAGE";
        if(context.isGroup) return "GROUP_MESSAGE";
        if(context.isSystem) return "SYSTEM_MESSAGE";
        return "BROADCAST_MESSAGE";
    }

    /*
    * Route 
    */
    private void routeMessage(
        MessageContext context,
        Map<String, Object> message,
        String[] routes
    ) {
        messageRouter.routeMessage(
            context.sessionId,
            message,
            message,
            routes
        );
    }

    /*
    * Determine 
    */
    private String[] determineRoutes(MessageContext context) {
        List<String> routes = new ArrayList<>();
        if(context.isDirect) {
            routes.add("DIRECT");
        }
        if(context.isGroup) {
            routes.add("GROUP");
        }
        routes.add("CHAT");
        return routes.toArray(new String[0]);
    }

    /*
    * Extract Route 
    */
    public String extractRouteType(String sessionId, Map<String, Object> payload) {
        MessageContext context = analyzeContext(sessionId, payload);
        String[] routes = determineRoutes(context);
        for(String route : routes) {
            if("GROUP".equals(route)) return "GROUP";
            if("DIRECT".equals(route)) return "DIRECT"; 
        }
        return "CHAT";
    }

    /*
    * Track 
    */
    private void trackMessage(MessageContext context) {
        eventTracker.track(
            "message-analyzed",
            Map.of(
                "type", getMessageType(context),
                "sessionId", context.sessionId,
                "isDirect", context.isDirect,
                "isGroup", context.isGroup
            ),
            EventDirection.PROCESSED,
            context.sessionId,
            "system"
        );
    }
}