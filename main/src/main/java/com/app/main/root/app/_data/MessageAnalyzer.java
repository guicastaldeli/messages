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
        Map<String, Object> message = messageData(payload, context);
        routeMessage(context, message, routes);
        trackMessage(context);
    }

    private Map<String, Object> messageData(
        Map<String, Object> payload,
        MessageContext context
    ) {
        Map<String, Object> message = new HashMap<>(payload);
        if (!message.containsKey("routingMetadata")) {
            message.put("routingMetadata", Map.of(
                "sessionId", context.sessionId,
                "messageType", getMessageType(context),
                "messageId", context.messageId,
                "isDirect", context.isDirect,
                "isGroup", context.isGroup,
                "isBroadcast", context.isBroadcast,
                "priority", "NORMAL"
            ));
        }
        
        System.out.println("Preserved perspective - isSelf: " + message.get("isSelf") + ", displayUsername: " + message.get("displayUsername"));
        return message;
    }

    /*
    * Analyze 
    */
    public MessageContext analyzeContext(String sessionId, Map<String, Object> payload) {
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
    * Determine 
    */
    public String[] determineRoutes(MessageContext context) {
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
