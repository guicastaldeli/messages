package com.app.main.root.app._service;
import com.app.main.root.app._utils.FunctionalInterfaces;
import com.app.main.root.app._data.CommandSystemMessageList;
import com.app.main.root.app._data.MessageContext;
import com.app.main.root.app._data.MessagePerspective;
import org.springframework.context.annotation.Lazy;
import org.springframework.stereotype.Component;
import java.util.*;

@Component
public class SystemMessageService {
    private String ctx;
    private String action;
    private String username;
    private boolean isSelf;

    @Lazy private ServiceManager serviceManager;
    private final Map<String, String> messageTemplates = new HashMap<>();
    private final String userJoined = CommandSystemMessageList.USER_JOINED_GROUP.get();
    private final String userLeft = CommandSystemMessageList.USER_LEFT_GROUP.get();
    private final String userRemoved = CommandSystemMessageList.USER_REMOVED_GROUP.get();

    private void initTemplates() {
        messageTemplates.put("USER_JOINED", CommandSystemMessageList.USER_JOINED_GROUP.get());
        messageTemplates.put("USER_LEFT", CommandSystemMessageList.USER_LEFT_GROUP.get());
        messageTemplates.put("USER_ADDED", CommandSystemMessageList.USER_ADDED_GROUP.get());
        messageTemplates.put("USER_REMOVED", CommandSystemMessageList.USER_JOINED_GROUP.get());
        messageTemplates.put("GROUP_CREATED", CommandSystemMessageList.GROUP_CREATED.get());
        messageTemplates.put("GROUP_DELETED", CommandSystemMessageList.GROUP_DELETED.get());
    }

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

    /*
    * Resolve Content 
    */
    private String resolveMessageFromPerspective(
        MessageContext context, 
        MessagePerspective perspective
    ) {
        String eventType = context.getEventType();
        String template = messageTemplates.get(eventType);
        if(template == null) return "SYSTEM MESSAGE";

        String actualUsername = (String) context.getContext().get("username");
        String usernameSet = 
            perspective.isSelf() ? "You" :
            (actualUsername != null ? actualUsername : "User");
        String content = template.replace("{username}", usernameSet);

        Map<String, Object> contextMap = context.getContext();
        for(Map.Entry<String, Object> entry : contextMap.entrySet()) {
            if(!"username".equals(entry.getKey())) {
                String placeholder = "{" + entry.getKey() + "}";
                content = content.replace(placeholder, String.valueOf(entry.getValue()));
            }
        }

        return content;
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
        String usernameData = (String) data.get("username");
        
        MessageContext context = new MessageContext(
            sessionId, 
            "",
            generateId(), 
            chatId != null ? chatId : groupId,  
            targetUserId, 
            usernameData, 
            isDirect,
            isGroup, 
            true, 
            false
        )
        .toMessagePerspective().withPerspective(perspectiveUserId)
        .withEventType(eventType)
        .withContext("groupId", groupId)
        .withContext("groupName", data.get("groupName"))
        .withAllContext(data);

        MessagePerspective perspective = context.toMessagePerspective();
        String resolvedContent = resolveMessageFromPerspective(context, perspective);
        return context.withResolvedContext(resolvedContent);
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
        Map<String, Object> groupInfo = new HashMap<>();
        try {
            if(groupId != null) {
                groupInfo = serviceManager.getGroupService().getGroupInfo(groupId);
            }
        } catch(Exception err) {
            System.err.println("Group info not found" + err);
        }
        Map<String, Object> data = (Map<String, Object>) createDataFn.apply(username, groupId, groupInfo, addData);
        
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
                targetUserId, 
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
                    memberSessionId, 
                    eventType, 
                    data
                );
                Map<String, Object> payload = (Map<String, Object>) createPayloadFn.apply(context);
                deliverMessageFn.accept(memberUserId, payload, "SYSTEM_MESSAGE");
            }
        }
    }

    /* Id */
    private String generateId() {
        return "sys_" + System.currentTimeMillis() + "_" + UUID.randomUUID().toString().substring(0, 8);
    }
}
