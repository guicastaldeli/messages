package com.app.main.root.app._server;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Component;
import com.app.main.root.app.EventTracker;
import com.app.main.root.app.EventLog.EventDirection;
import com.app.main.root.app._server.RouteContext.RouteHandler;
import com.app.main.root.app._service.ServiceManager;
import com.app.main.root.app._utils.ColorConverter;

import java.util.*;

@Component
public class MessageRouter {
    private final ServiceManager serviceManager;
    private final SimpMessagingTemplate messagingTemplate;
    private final EventTracker eventTracker;
    private final ConnectionTracker connectionTracker;
    private final Map<String, RouteHandler> routeHandlers;
    @Autowired private ColorConverter colorConverter;

    public MessageRouter(
        SimpMessagingTemplate messagingTemplate,
        EventTracker eventTracker,
        ConnectionTracker connectionTracker, 
        ServiceManager serviceManager
    ) {
        this.messagingTemplate = messagingTemplate;
        this.eventTracker = eventTracker;
        this.connectionTracker = connectionTracker;
        this.serviceManager = serviceManager;
        this.routeHandlers = new HashMap<>();
        registerDefaultHandlers();
    }

    /*
    * Default Handlers 
    */
    private void registerDefaultHandlers() {
        routeHandlers.put("CHAT", this::handleChatRoute);
        routeHandlers.put("USER", this::handleUserRoute);
        routeHandlers.put("DIRECT", this::handleDirectRoutes);
        routeHandlers.put("GROUP", this::handleGroupRoutes);
        routeHandlers.put("BROADCAST", this::handleBroadcastRoute);
        routeHandlers.put("SESSION", this::handleSessionRoute);
    }

    /* Chat */
    private void handleChatRoute(RouteContext context) {
        context.targetSessions.add(context.sessionId);
        context.metadata.put("queue", "/queue/messages/all");
    }

    /* User Messages */
    private void handleUserRoute(RouteContext context) {
        serviceManager.getUserService().handleUserRoute(context);
    }

    /* Direct */
    private void handleDirectRoutes(RouteContext context) {
        serviceManager.getDirectService().handleDirectRoutes(context);
    }

    /* Group */
    private void handleGroupRoutes(RouteContext context) {
        serviceManager.getGroupService().handleGroupRoutes(context);
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
            if(targetSession.equals(context.sessionId)) {
                context.metadata.put("queue", "/user/queue/messages/self");
            } else {
                context.metadata.put("queue", "/user/queue/messages/others");
            }
        }
    }

    public void routeMessage(
        String sessionId,
        Object payload,
        Map<String, Object> message,
        String[] routes
    ) {
        try {
            if(serviceManager == null || serviceManager.getMessagePerspectiveService() == null) {
                System.err.println("ERR. PerspectiveService not available >:(. Routing without perspective :/");
                routeToDestination(sessionId, payload, message, routes);
                return;
            }
            Map<String, Object> messageWithPerspective = this.serviceManager.getMessagePerspectiveService()
                .applyPerspective(sessionId, message);
            routeToDestination(sessionId, payload, messageWithPerspective, routes);
        } catch(Exception err) {
            System.err.println("ERR. Routes" + err.getMessage());
            err.printStackTrace();
            routeToDestination(sessionId, payload, message, routes);
        }
    }

    private void routeToDestination(
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
            if(targetSession.equals(context.sessionId)) {
                finalQueue = "/user/queue/messages/self";
            } else {
                finalQueue = "/user/queue/messages/others";
            }

            String msg = colorConverter.style("Sending to session " + targetSession + " via queue" + finalQueue, "magenta", "italic");
            System.out.println(msg);
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
            messagingTemplate.convertAndSend(destination, data);
        } catch(Exception err) {
            System.err.println("Error routing message: " + err.getMessage());
        }
    }
}
