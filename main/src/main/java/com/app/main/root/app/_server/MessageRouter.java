package com.app.main.root.app._server;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Component;
import com.app.main.root.app.EventTracker;
import com.app.main.root.app.EventLog.EventDirection;
import com.app.main.root.app._server.RouteContext.RouteHandler;
import java.util.*;

@Component
public class MessageRouter {
    private final SimpMessagingTemplate messagingTemplate;
    private final EventTracker eventTracker;
    private final ConnectionTracker connectionTracker;
    private final Map<String, RouteHandler> routeHandlers;

    public MessageRouter(
        SimpMessagingTemplate messagingTemplate,
        EventTracker eventTracker,
        ConnectionTracker connectionTracker
    ) {
        this.messagingTemplate = messagingTemplate;
        this.eventTracker = eventTracker;
        this.connectionTracker = connectionTracker;
        this.routeHandlers = new HashMap<>();
        registerDefaultHandlers();
    }

    /*
    * Default Handlers 
    */
    private void registerDefaultHandlers() {
        routeHandlers.put("SELF", this::handleSelfRoute);
        routeHandlers.put("OTHERS", this::handleOthersRoute);
        routeHandlers.put("GROUP", this::handleGroupRoute);
        routeHandlers.put("BROADCAST", this::handleBroadcastRoute);
        routeHandlers.put("SESSION", this::handleSessionRoute);
        routeHandlers.put("USER", this::handleUserRoute);
    }

    /* Self */
    private void handleSelfRoute(RouteContext context) {
        context.targetSessions.add(context.sessionId);
        context.metadata.put("queue", "/queue/messages/self");
    }

    /* Others */
    private void handleOthersRoute(RouteContext context) {
        Set<String> allSessions = connectionTracker.getAllActiveSessions();
        allSessions.remove(context.sessionId);
        context.targetSessions.addAll(allSessions);
        context.metadata.put("queue", "/queue/messages/others");
    }

    /* Group */
    private void handleGroupRoute(RouteContext context) {
        String chatId = (String) context.message.get("chatId");
        if(chatId != null && chatId.startsWith("group_id")) {
            Set<String> groupSessions = connectionTracker.getGroupSessions(chatId);
            groupSessions.remove(context.sessionId);
            context.targetSessions.addAll(groupSessions);
            context.metadata.put("queue", "/queue/messages/group" + chatId);
        }
    }

    /* Broadcast */
    private void handleBroadcastRoute(RouteContext context) {
        context.targetSessions.addAll(connectionTracker.getAllActiveSessions());
        context.metadata.put("queue", "/topic/broadcast");
    }

    /* Session */
    private void handleSessionRoute(RouteContext context) {
        String targetSession = (String) context.message.get("targetSession");
        if(targetSession != null) {
            context.targetSessions.add(targetSession);
            context.metadata.put("queue", "/queue/messages/direct");
        }
    }

    /* User */
    private void handleUserRoute(RouteContext context) {
        String targetUserId = (String) context.message.get("taregetUserId");
        if(targetUserId != null) {
            String targetSession = connectionTracker.userService.getSessionByUserId(targetUserId);
            if(targetSession != null) {
                context.targetSessions.add(targetSession);
                context.metadata.put("queue", "/queue/messages/direct");
            }
        }
    }

    public void routeMessage(
        String sessionId,
        Object payload,
        Map<String, Object> message,
        String[] routes
    ) {
        RouteContext context = new RouteContext(sessionId, payload, message);
        for(String route : routes) {
            RouteHandler handler = routeHandlers.get(route);
            if(handler != null) {
                handler.handle(context);
            }
        }
        execRouting(context);
    }

    private void execRouting(RouteContext context) {
        String baseQueue = (String) context.metadata.getOrDefault("queue", "/queue/messages");

        for(String targetSession : context.targetSessions) {
            String finalQueue = baseQueue;
            if(
                finalQueue.startsWith("/queue/") && 
                !targetSession.equals(context.sessionId)
            ) {
                finalQueue = "/queue/messages/others";
            }
            sendToUser(targetSession, finalQueue, context.message);
        }

        eventTracker.track(
            "message-routed",
            context.message,
            EventDirection.SENT,
            context.sessionId,
            "router"
        );
    }

    private void sendToUser(
        String sessionId,
        String destination,
        Object data
    ) {
        try {
            messagingTemplate.convertAndSendToUser(sessionId, destination, data);
        } catch(Exception err) {
            System.err.println("Error routing message: " + err.getMessage());
        }
    }
}
