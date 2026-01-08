package com.app.main.root.app._data;
import com.app.main.root.app._data.ConfigSocketEvents.EventHandler;

public class EventConfig {
    private final EventHandler handler;
    private final String destination;
    private final boolean broadcast;

    public EventConfig(
        EventHandler handler,
        String destination,
        boolean broadcast
    ) {
        this.handler = handler;
        this.destination = destination;
        this.broadcast = broadcast;
    }

    /**
     * Get Handler
     */
    public EventHandler getHandler() {
        return handler;
    } 

    /**
     * Get Destination
     */
    public String getDestination() {
        return destination;
    }

    /**
     * Broadcast
     */
    public boolean isBroadcast() {
        return broadcast;
    }
}
