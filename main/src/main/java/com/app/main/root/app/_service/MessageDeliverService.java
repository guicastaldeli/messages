package com.app.main.root.app._service;
import com.app.main.root.app._server.ConnectionTracker;
import com.app.main.root.app._server.MessageRouter;
import com.app.main.root.app._data.MessageContext;
import org.springframework.stereotype.Service;
import java.util.*;

@Service
public class MessageDeliverService {
    private final MessageRouter messageRouter;
    private final ConnectionTracker connectionTracker;
    private final ServiceManager serviceManager;

    public MessageDeliverService(
        MessageRouter messageRouter, 
        ServiceManager serviceManager, 
        ConnectionTracker connectionTracker
    ) {
        this.messageRouter = messageRouter;
        this.serviceManager = serviceManager;
        this.connectionTracker = connectionTracker;
    }

    /*
    * Send 
    */
    public void sendMessage(
        MessageContext context,
        Map<String, Object> payload
    ) {
        if(context.getContextType() == MessageContext.ContextType.SYSTEM) {
            serviceManager.getSystemMessageService().sendMessage(
                context.getEventType(),
                context.targetUserId,
                context.username,
                context.chatId,
                context.chatId,
                context.isDirect,
                extractGroupData(context)
            );
        } else if(context.getContextType() == MessageContext.ContextType.REGULAR) {
            serviceManager.getMessageService().sendMessage(
                context.sessionId,
                context.content,
                context.chatId,
                context.isDirect,
                payload
            );
        }
    }

    /*
    * Data 
    */
    private Map<String, Object> createData(
        String username,
        String groupId,
        Map<String, Object> groupInfo,
        Map<String, Object> addData
    ) {
        Map<String, Object> data = new HashMap<>();
        data.put("username", username);
        data.put("groupId", groupId);
        data.put("groupName", groupInfo.get("name"));
        if(addData != null) data.putAll(addData);
        return data;
    }

    /*
    * Payload 
    */
    public Map<String, Object> createPayload(MessageContext context) {
        Map<String, Object> payload = new HashMap<>();
        long time = System.currentTimeMillis();

        payload.put("content", context.resolveContent());
        payload.put("chatId", context.chatId);
        payload.put("timestamp", time);
        payload.put("messageId", context.messageId);
        payload.put("sessionId", context.sessionId);
        payload.put("isDirect", context.isDirect);
        payload.put("isGroup", context.isGroup);

        if(context.getContextType() == MessageContext.ContextType.SYSTEM) {
            payload.put("type", "SYSTEM_MESSAGE");
        } else {
            payload.put("type", "MESSAGE");
            payload.put("senderId", context.targetUserId);
        }

        payload.putAll(context.getContext());
        return payload;
    }

    /*
    * Extract from Group 
    */
    private Map<String, Object> extractGroupData(MessageContext context) {
        Map<String, Object> data = new HashMap<>();
        data.put("groupId", context.chatId);
        data.put("groupName", context.getContext().get("groupName"));
        return data;
    }

    /*
    * Determine Destination 
    */
    private String determineDestination(
        String sessionId,
        String messageType,
        Map<String, Object> payload
    ) {
        switch(messageType) {
            case "SYSTEM_MESSAGE":
                return "SYSTEM_MESSAGE";
            case "MESSAGE":
                boolean isDirect = (Boolean) payload.getOrDefault("isDirect", true);
                return isDirect ? "DIRECT_MESSAGE" : "GROUP_MESSAGE";
            default:
                return "MESSAGE";
        }
    }

    /*
    * Determine Route Types 
    */
    private String[] determineRouteTypes(String messageType, Map<String, Object> payload) {
        switch(messageType) {
            case "SYSTEM_MESSAGE": 
                return new String[]{"SYSTEM"};
            case "MESSAGE":
                boolean isDirect = (Boolean) payload.getOrDefault("isDirect", true);
                return isDirect ? new String[]{"GROUP", "CHAT"} : new String[]{"DIRECT", "CHAT"};
            default:
                return new String[]{"CHAT"};
        }
    }

    /*
    * Deliver 
    */
    private void deliverMessage(
        String sessionId,
        Map<String, Object> payload,
        String messageType
    ) {
        String destination = determineDestination(sessionId, messageType, payload);
        serviceManager.getUserService().sendMessageToUser(sessionId, messageType, destination);

        String[] routingTypes = determineRouteTypes(messageType, payload);
        messageRouter.routeMessage(sessionId, payload, payload, routingTypes);
    }
}
