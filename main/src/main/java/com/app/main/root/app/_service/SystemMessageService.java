package com.app.main.root.app._service;
import com.app.main.root.app._data.CommandSystemMessageList;
import com.app.main.root.app._data.MessageContext;
import org.springframework.context.annotation.Lazy;
import com.app.main.root.app._utils.FunctionalInterfaces;
import java.util.*;

public class SystemMessageService {
    private String ctx;
    private String action;
    private String username;
    private boolean isSelf;

    @Lazy private ServiceManager serviceManager;
    private final Map<String, String> messageTemplates = new HashMap<>();
    private final String userJoined = CommandSystemMessageList.USER_JOINED_GROUP.get();
    private final String userLeft = CommandSystemMessageList.USER_JOINED_GROUP.get();
    private final String userRemoved = CommandSystemMessageList.USER_REMOVED_GROUP.get();

    public String generateMessage(
        String templateKey,
        Map<String, Object> variables
    ) {
        String template = messageTemplates.get(templateKey);
        if(template == null) return "SYSTEM MESSAGE **RETURN";

        for(Map.Entry<String, Object> entry : variables.entrySet()) {
            String placeholder = "{" + entry.getKey() + "}";
            template = template.replace(placeholder, String.valueOf(entry.getValue()));
        }

        return template;
    }

    public String setCtx(String data) {
        ctx = data;
        return data;
    }

    public String setAction(String data, String user) {
        action = data;
        username = user;
        return data;
    }

    /* Self */
    public String resolveSelfAction() {
        switch(action) {
            case "JOINED": return userJoined;
            case "LEFT": return userLeft;
            //case "ADDED": return userAdded;*** //LATER....
            case "REMOVED": return userRemoved;
            default: return "You " + action + "**df";
        }
    }

    /* Group */
    public String resolveGroupAction() {
        switch(action) {
            case "JOINED": return username + userJoined;
            case "LEFT": return username + userLeft;
            case "REMOVED": return username + userRemoved;
            default: return username + " " + action + "**df";
        }
    }

    /*
    * Id 
    */
    private String generateId() {
        return "sys_" + System.currentTimeMillis() + "_" + UUID.randomUUID().toString().substring(0, 8);
    }

    /*
    * Create Message 
    */
    private MessageContext createMessage(
        String sessionId,
        String chatId,
        String groupId,
        String targetUserId,
        String perspectiveUserId,
        String eventType,
        Map<String, Object> data
    ) {
        boolean isDirect = (Boolean) data.getOrDefault("isDirect", false);
        boolean isGroup = groupId != null && !isDirect;
        
        MessageContext context = new MessageContext(
            sessionId, 
            eventType,
            generateId(), 
            chatId != null ? chatId : groupId,  
            targetUserId, 
            username, 
            isDirect,
            isGroup, 
            true, 
            perspectiveUserId == null
        );
        return context
            .withPerspective(perspectiveUserId)
            .withEventType(eventType)
            .withContext("groupId", groupId)
            .withContext("groupName", data.get("groupName"))
            .withAllContext(data);
    }

    /*
    * Send Message 
    */
    public void sendMessage(
        String eventType,
        String targetUserId,
        String username,
        String chatId,
        String groupId,
        boolean isDirect,
        Map<String, Object> addData,
        FunctionalInterfaces.Function4<
            String, String, Map<String, Object>, Map<String, Object>, Map<String, Object>
        > createDataFn,
        FunctionalInterfaces.Function1<
            MessageContext, Map<String, Object>
        > createPayloadFn,
        FunctionalInterfaces.TriConsumer<
            String, Map<String, Object>, String
        > deliverMessageFn
    ) {
        Map<String, Object> data = (Map<String, Object>) createDataFn.apply(username, groupId, null, addData);
        
        if(isDirect) {
            String targetSessionId = serviceManager.getUserService().getSessionByUserId(targetUserId);
            if(targetSessionId == null) throw new RuntimeException("targetSessionId null");

            data.put("chatId", chatId);
            data.put("isDirect", true);
            MessageContext context = createMessage(
                targetSessionId, 
                chatId, 
                chatId, 
                targetUserId, 
                targetSessionId, 
                eventType, 
                data
            );

            Map<String, Object> payload = (Map<String, Object>) createPayloadFn.apply(context);
            deliverMessageFn.accept(targetSessionId, payload, "SYSTEM_MESSAGE");
        } else {
            Set<String> groupSessionIds = serviceManager.getGroupService().getGroupSessionIds(groupId);

            for(String memberSessionId : groupSessionIds) {
                String memberUserId = serviceManager.getUserService().getUserIdBySession(memberSessionId);
                MessageContext context = createMessage(
                    memberSessionId, 
                    chatId, 
                    groupId, 
                    targetUserId, 
                    groupId, 
                    eventType, 
                    data
                );
                Map<String, Object> payload = (Map<String, Object>) createPayloadFn.apply(context);
                deliverMessageFn.accept(memberUserId, payload, "SYSTEM_MESSAGE");
            }
        }
    }

    public String resolve() {
        if(isSelf) {
            return resolveSelfAction();
        } else {
            return resolveGroupAction();
        }
    }
}
