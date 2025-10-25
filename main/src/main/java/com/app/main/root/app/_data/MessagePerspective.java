package com.app.main.root.app._data;
import java.util.*;

public class MessagePerspective {
    private final MessageContext messageContext;
    private final Map<String, Object> context;
    private final String targetUserId;
    private String perspectiveUserId;

    public MessagePerspective(
        MessageContext messageContext,
        String targetUserId,
        String perspectiveUserId
    ) {
        this(
            messageContext,
            targetUserId,
            perspectiveUserId,
            new HashMap<>()
        );
    }

    public MessagePerspective(
        MessageContext messageContext,
        String targetUserId,
        String perspectiveUserId,
        Map<String, Object> context
    ) {
        this.messageContext = messageContext;
        this.targetUserId = targetUserId;
        this.perspectiveUserId = perspectiveUserId;
        this.context = new HashMap<>(context);
    }

    public MessagePerspective with(String key, Object value) {
        context.put(key, value);
        return this;
    }

    public MessagePerspective withAll(Map<String, Object> data) {
        if(data != null) context.putAll(data);
        return this;
    }

    /*
    * Perspective 
    */
    public MessageContext withPerspective(String perspectiveUserId) {
        this.perspectiveUserId = perspectiveUserId;
        return this.messageContext
            .withAllContext(this.context)
            .withContext("perspectiveUserId", perspectiveUserId)
            .withContext("isSelf", isSelfPerspective())
            .withContext("displayUsername", displayUsername());
    } 

    public boolean isSelfPerspective() {
        return perspectiveUserId != null && targetUserId != null &&
            perspectiveUserId.equals(targetUserId);
    }

    public boolean isSenderPerspective() {
        return perspectiveUserId != null && 
            targetUserId != null &&
            perspectiveUserId.equals(targetUserId);
    }

    public String displayUsername() {
        if(isSelfPerspective()) {
            return "";
        } else {
            String username = (String) context.get("username");
            return username != null ? username : messageContext.username;
        }
    }

    public boolean isSelf() {
        return targetUserId != null && targetUserId.equals(perspectiveUserId);
    }
}
