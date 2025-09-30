package com.app.main.root.app.__controllers;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.simp.SimpMessageHeaderAccessor;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Controller;
import java.util.Map;

@Controller
public class SocketIdController {
    private final SimpMessagingTemplate messagingTemplate;

    public SocketIdController(SimpMessagingTemplate messagingTemplate) {
        this.messagingTemplate = messagingTemplate;
    }

    @MessageMapping("/get-socket-id")
    public void getSocketId(SimpMessageHeaderAccessor headerAccessor) {
        String socketId = headerAccessor.getSessionId();

        Map<String, String> res = Map.of(
            "event", "connect",
            "data", socketId
        );
        messagingTemplate.convertAndSendToUser(
            socketId,
            "/queue/socket-id",
            res
        );
    }
}
