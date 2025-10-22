package com.app.main.root.app._service;
import org.springframework.stereotype.Component;
import com.app.main.root.app._server.RouteContext;

@Component
public class DirectService {
    private final ServiceManager serviceManager;

    public DirectService(ServiceManager serviceManager) {
        this.serviceManager = serviceManager;
    }
    
    /*
    **
    ***
    *** Routes
    ***
    ** 
    */
    public void handleDirectRoutes(RouteContext context) {
        handleSelfRoute(context);
        handleOthersRoute(context);
    } 

    /* Self */
    private void handleSelfRoute(RouteContext context) {
        context.targetSessions.add(context.sessionId);
        context.metadata.put("queue", "/queue/messages/direct/self");
    }

    /* Others */
    private void handleOthersRoute(RouteContext context) {
        String targetUserId = (String) context.message.get("targetUserId");
        if(targetUserId != null) {
            String targetSession = serviceManager.getUserService().getSessionByUserId(targetUserId);
            if(targetSession != null && !targetSession.equals(context.sessionId)) {
                context.targetSessions.add(targetSession);
                context.metadata.put("queue", "/user/queue/messages/direct/others");
            }
        }
    }
}
