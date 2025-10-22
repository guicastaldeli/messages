package com.app.main.root.app._service;
import org.springframework.stereotype.Component;
import com.app.main.root.app._server.RouteContext;

@Component
public class DirectService {
    private final UserService userService;

    public DirectService(UserService userService) {
        this.userService = userService;
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
        context.metadata.put("queue", "/user/queue/messages/direct/self");
    }

    /* Others */
    private void handleOthersRoute(RouteContext context) {
        String targetUserId = (String) context.message.get("targetUserId");
        if(targetUserId != null) {
            String targetSession = userService.getSessionByUserId(targetUserId);
            if(targetSession != null && !targetSession.equals(context.sessionId)) {
                context.targetSessions.add(targetSession);
                context.metadata.put("queue", "/user/queue/messages/direct/others");
            }
        }
    }
}
