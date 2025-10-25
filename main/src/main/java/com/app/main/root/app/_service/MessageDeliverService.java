package com.app.main.root.app._service;
import com.app.main.root.app._server.ConnectionTracker;
import com.app.main.root.app._server.MessageRouter;
import com.app.main.root.app._data.MessageAnalyzer;
import com.app.main.root.app._data.MessageContext;
import org.springframework.stereotype.Service;
import java.util.*;

@Service
public class MessageDeliverService {
    private final MessageAnalyzer messageAnalyzer;
    private final MessageRouter messageRouter;
    private final ConnectionTracker connectionTracker;
    private final ServiceManager serviceManager;

    public MessageDeliverService(
        MessageAnalyzer messageAnalyzer,
        MessageRouter messageRouter, 
        ServiceManager serviceManager, 
        ConnectionTracker connectionTracker
    ) {
        this.messageAnalyzer = messageAnalyzer;
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
                extractGroupData(context),
                this::createData,
                this::createPayload,
                this::deliverMessage
            );
        } else if(context.getContextType() == MessageContext.ContextType.REGULAR) {
            serviceManager.getMessageService().sendMessage(
                context.sessionId,
                context.content,
                context.chatId,
                context.isDirect,
                payload,
                this::createPayload,
                this::deliverMessage
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
        String type = messageAnalyzer.getMessageType(context);

        payload.put("content", context.resolveContent());
        payload.put("chatId", context.chatId);
        payload.put("timestamp", time);
        payload.put("messageId", context.messageId);
        payload.put("sessionId", context.sessionId);
        payload.put("isDirect", context.isDirect);
        payload.put("isGroup", context.isGroup);

        Boolean isSelfPerspective = (Boolean) context.getContext().get("isSelf");
        String displayUsername = (String) context.getContext().get("displayUsername");
        payload.put("isSelf", isSelfPerspective != null ? isSelfPerspective : false);
        payload.put("displayUsername", displayUsername != null ? displayUsername : context.username);

        if(context.getContextType() == MessageContext.ContextType.SYSTEM) {
            payload.put("type", "SYSTEM_MESSAGE");
        } else {
            payload.put("type", type);
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
    * Deliver 
    */
    public void deliverMessage(
        String sessionId,
        Map<String, Object> payload
    ) {
        MessageContext context = messageAnalyzer.analyzeContext(sessionId, payload);
        messageAnalyzer.organizeAndRoute(sessionId, payload);
        String[] routingTypes = messageAnalyzer.determineRoutes(context);
        messageRouter.routeMessage(sessionId, payload, payload, routingTypes);
    }
}