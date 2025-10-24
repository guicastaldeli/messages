package com.app.main.root.app._service;
import org.springframework.stereotype.Component;
import com.app.main.root.app._data.MessageContext;
import com.app.main.root.app._utils.MessageTemplateResolver;
import java.util.*;

@Component
public class MessageFactory {
    private final MessageTemplateResolver templateResolver;

    public MessageFactory(MessageTemplateResolver templateResolver) {
        this.templateResolver = templateResolver;
    }

    public Map<String, Object> createPayload(MessageContext context) {
        Map<String, Object> payload = new HashMap<>();
        long time = System.currentTimeMillis();

        payload.put("content", context.resolveContent());
        payload.put("chatId", context.chatId);
        payload.put("timestamp", time);
        payload.put("messageId", context.messageId);
        payload.put("sessionId", context.sessionId);
        payload.put("username", context.username);

        if(context.getContextType() == MessageContext.ContextType.SYSTEM) {
            payload.put("type", "SYSTEM_MESSAGE");
            payload.put("event", context.getEventType());
            payload.put("isSelf", context.isSelfPerspective());
            payload.put("perspectiveUserId", context.getPerspectiveUserId());
        } else {
            payload.put("type", "MESSAGE");
            payload.put("isDirect", context.isDirect);
            payload.put("isGroup", context.isGroup);
            payload.put("senderId", context.targetUserId);
        }

        payload.putAll(context.getContext());
        return payload;
    }
}
