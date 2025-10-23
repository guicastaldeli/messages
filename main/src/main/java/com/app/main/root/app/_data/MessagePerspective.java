package com.app.main.root.app._data;
import java.util.*;

public class MessagePerspective {
    private final Map<String, Object> context = new HashMap<>();
    private final String eventType;
    private final String targetUserId;
    private final String perspectiveUserId;

    public MessagePerspective(
        String eventType,
        String targetUserId,
        String perspectiveUserId
    ) {
        this.eventType = eventType;
        this.targetUserId = targetUserId;
        this.perspectiveUserId = perspectiveUserId;
    }

    public MessagePerspective with(String key, Object value) {
        context.put(key, value);
        return this;
    }

    public boolean isSelf() {
        return targetUserId != null && targetUserId.equals(perspectiveUserId);
    }

    public String getEventType() {
        return eventType;
    }
    public String getTargetUserId() {
        return targetUserId;
    }
    public String getPerspectiveUserId() {
        return perspectiveUserId;
    }
    public Map<String, Object> getContext() {
        return context;
    }
}
