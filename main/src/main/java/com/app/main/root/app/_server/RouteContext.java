package com.app.main.root.app._server;
import java.util.*;

public class RouteContext {
    public final String sessionId;
    public final Object payload;
    public final String destination; 
    public final Map<String, Object> message;
    public final Set<String> targetSessions;
    public final Map<String, Object> metadata;

    public RouteContext(
        String sessionId,
        Object payload,
        Map<String, Object> message
    ) {
        this.sessionId = sessionId;
        this.payload = payload;
        this.message = message;
        this.destination = "";
        this.targetSessions = new HashSet<>();
        this.metadata = new HashMap<>();
    }

    public interface RouteHandler {
        void handle(RouteContext context);
    }
}
