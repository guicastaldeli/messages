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
        message.put("routingMetadata", Map.of(
            "sessionId", context.sessionId,
            "messageType", getMessageType(context),
            "messageId", context.messageId,
            "isDirect", context.isDirect,
            "isGroup", context.isGroup,
            "isBroadcast", context.isBroadcast,
            "priority", "NORMAL"
        ));
        
        
        System.out.println("=== MESSAGE ANALYZER PRESERVATION ===");
        System.out.println("Original payload keys: " + payload.keySet());
        System.out.println("Preserved isSelf: " + message.get("isSelf"));
        System.out.println("Preserved displayUsername: " + message.get("displayUsername"));
        System.out.println("Final message keys: " + message.keySet());
        System.out.println("=====================================");
        return message;
    }

    /*
    * Analyze 
    */
    public MessageContext analyzeContext(String sessionId, Map<String, Object> payload) {
        String content = (String) payload.get("content");
        String messageId = (String) payload.get("messageId");
        String chatId = (String) payload.get("chatId");
        String targetUserId = (String) payload.get("targetUserId");
        String username = (String) payload.get("username");
        boolean isGroup = (chatId != null && chatId.startsWith("group_")) ||
                            "GROUP".equals(payload.get("type")) ||
                            "GROUP".equals(payload.get("chatType"));
        boolean isDirect = (targetUserId != null) && !isGroup;
        boolean isSystem = "SYSTEM_MESSAGE".equals(payload.get("type"));
        boolean isBroadcast = (chatId == null && targetUserId == null);

        if (sessionId == null) {
            System.out.println("Session id is null");
        } else {
            System.out.println(sessionId);
        }
        if (chatId == null) {
            System.out.println("chat id is null");
        } else {
            System.out.println(chatId);
        }
        if (targetUserId == null) {
            System.out.println("targetuser id is null");
        } else {
            System.out.println(targetUserId);
        }
        if (messageId == null) {
            System.out.println("message id is null");
        } else {
            System.out.println(messageId);
        }

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
            isBroadcast
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
