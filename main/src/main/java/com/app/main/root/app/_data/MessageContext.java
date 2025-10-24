package com.app.main.root.app._data;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Lazy;
import com.app.main.root.app._service.ServiceManager;
import java.util.*;

public class MessageContext {
    public enum ContextType {
        SYSTEM,
        REGULAR,
        NOTIFICATION
    }

    public final String sessionId;
    public final String content;
    public final String messageId;
    public final String chatId;
    public final String targetUserId;
    public final String username;
    public final boolean isDirect;
    public final boolean isGroup;
    public final boolean isSystem;
    public final boolean isBroadcast;
    
    @Autowired @Lazy private ServiceManager serviceManager;
    private String perspectiveUserId;
    private String eventType;
    private ContextType contextType;
    private final Map<String, Object> context = new HashMap<>();
    private String resolvedContent;

    public MessageContext(
        String sessionId,
        String content,
        String messageId,
        String chatId,
        String targetUserId,
        String username,
        boolean isDirect,
        boolean isGroup,
        boolean isSystem,
        boolean isBroadcast
    ) {
        this.sessionId = sessionId;
        this.content = content;
        this.messageId = messageId;
        this.chatId = chatId;
        this.targetUserId = targetUserId;
        this.username = username;
        this.isDirect = isDirect;
        this.isGroup = isGroup;
        this.isSystem = isSystem;
        this.isBroadcast = isBroadcast;
        this.contextType = isSystem ? ContextType.SYSTEM : ContextType.REGULAR;
        this.resolvedContent = content;
    }

    /*
    * Context 
    */
    public MessageContext withContext(String key, Object value) {
        this.context.put(key, value);
        return this;
    }

    public MessageContext withAllContext(Map<String, Object> c) {
        this.context.putAll(c);
        return this;
    }

    public MessageContext withContextType(ContextType contextType) {
        this.contextType = contextType;
        return this;
    }

    public Map<String, Object> getContext() {
        return context;
    }

    public ContextType getContextType() {
        return contextType;
    }

    /*
    * Event Type 
    */
    public MessageContext withEventType(String eventType) {
        this.eventType = eventType;
        return this;
    }

    public String getEventType() {
        return eventType;
    }

    /*
    * Extract Session Id 
    */
    public String extractSessionId(String sessionId) {
        return sessionId;
    }

    /*
    **
    *** Content
    ** 
    */
    public MessageContext withResolvedContext(String resolvedContext) {
        this.resolvedContent = resolvedContext;
        return this;
    }

    public String resolveContent() {
        return resolvedContent != null ? resolvedContent : content;   
    }

    public MessagePerspective toMessagePerspective() {
        return new MessagePerspective(this, targetUserId, perspectiveUserId, context)
            .withAll(this.context);
    }
}
