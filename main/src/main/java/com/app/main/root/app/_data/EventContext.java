package com.app.main.root.app._data;

public class EventContext {
    private final String eventName;
    private final EventConfig eventConfig;

    public EventContext(String eventName, EventConfig eventConfig) {
        this.eventName = eventName;
        this.eventConfig = eventConfig;
    }

    /**
     * Get Event Name
     */
    public String getEventName() {
        return eventName;
    }

    /**
     * Get Event Config
     */
    public EventConfig getEventConfig() {
        return eventConfig;
    }
}
