package com.app.main.root.app._data;

public class EventContextHolder {
    private static final ThreadLocal<EventContext> contextHolder = new ThreadLocal<>();

    /**
     * Set Context
     */
    public static void setContext(EventContext context) {
        contextHolder.set(context);
    }

    /**
     * Get Context
     */
    public static EventContext getContext() {
        return contextHolder.get();
    }

    /**
     * Clear Context
     */
    public static void clearContext() {
        contextHolder.remove();
    }
}
