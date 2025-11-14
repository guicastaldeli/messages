package com.app.main.root.app._service;
import com.app.main.root.app._crypto.message_encoder.PreKeyBundle;
import com.app.main.root.app._server.RouteContext;
import org.springframework.stereotype.Component;
import java.sql.SQLException;
import java.util.Arrays;
import java.util.Collections;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

@Component
public class DirectService {
    private final ServiceManager serviceManager;

    public DirectService(ServiceManager serviceManager) {
        this.serviceManager = serviceManager;
    }

    /*
    * Get Participants 
    */
    public String[] getChatParticipants(String chatId) {
        if(chatId.startsWith("direct_")) {
            String[] parts = chatId.split("_");
            if(parts.length == 3) {
                return new String[]{parts[1], parts[2]};
            }
        }
        return new String[0];
    }

    /*
    * Validate Chat Access 
    */
    public boolean userAccessChat(String userId, String chatId) {
        String[] participants = getChatParticipants(chatId);
        return Arrays.asList(participants).contains(userId);
    }

    /*
    * Get Other
    */
    public String getOtherParticipant(String chatId, String currentUserId) {
        String[] participants = getChatParticipants(chatId);
        for(String participant : participants) {
            if(!participant.equals(currentUserId)) {
                return participant;
            }
        }
        return null;
    }

    public String getOtherParticipantUsername(String chatId, String currentUserId) {
        String otherParticipantId = getOtherParticipant(chatId, currentUserId);
        if(otherParticipantId != null) {
            try {
                serviceManager.getUserService().getUsernameByUserId(otherParticipantId);
            } catch(Exception err) {
                System.err.println("Error getting username for other: " + err.getMessage());
            }
        }
        return null;
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

    /* Direct */
    private void hadleDirectMessageRoute(RouteContext context) {
        String chatId = (String) context.message.get("chatId");
        String recipientId = (String) context.message.get("recipientId");
        String senderId = (String) context.message.get("senderId");

        if(chatId != null && chatId.startsWith("direct_")) {
            try {
                if(!serviceManager.getMessageService().hasChatEncryption(chatId)) {
                    PreKeyBundle bundle = serviceManager.getMessageService().getChatPreKeyBundle(chatId);
                    serviceManager.getMessageService().initChatEncryption(chatId, bundle);
                }
            } catch(Exception err) {
                System.err.println("Direct chat encryption init failed: " + err.getMessage());
            }
            
            Set<String> targetSessions = new HashSet<>();
            targetSessions.add(context.sessionId);
            if(recipientId != null) {
                try {
                    if(serviceManager.getContactService().isContact(senderId, recipientId)) {
                        String recipientSession = serviceManager.getUserService().getSessionByUserId(recipientId);
                        if(recipientSession != null) {
                            targetSessions.add(recipientSession);
                        }
                    }
                } catch(Exception err) {
                    System.err.println("Error... direct route: " + err.getMessage());
                }
            }

            targetSessions.add(context.sessionId);
            context.targetSessions.addAll(targetSessions);
            context.metadata.put("chatId", chatId);
            context.metadata.put("queue", "/user/queue/messages/direct");
        }
    }

    /* Self */
    private void handleSelfRoute(RouteContext context) {
        context.targetSessions.add(context.sessionId);
        context.metadata.put("queue", "/user/queue/messages/direct/self");
    }

    /* Others */
    private void handleOthersRoute(RouteContext context) {
        String recipientId = (String) context.message.get("recipientId");
        String senderId = (String) context.message.get("senderId");
        if(recipientId != null && senderId != null) {
            try {
                if(serviceManager.getContactService().isContact(senderId, senderId)) {
                    String recipientSession = serviceManager.getUserService().getSessionByUserId(recipientId);
                    if(recipientSession != null && !recipientSession.equals(context.sessionId)) {
                        context.targetSessions.add(recipientSession);
                        context.metadata.put("queue", "/user/queue/messages/direct/others");
                    }
                }
            } catch(Exception err) {
                System.err.println("Error in others route: " + err.getMessage());
            }
        }
    }

    /*
    * Id 
    */
    public String generateDirectChatId(String fUserId, String sUserId)  {
        List<String> ids = Arrays.asList(fUserId, sUserId);
        Collections.sort(ids);
        return "direct_" + String.join("_", ids);
    }

    public Map<String, Object> getChatId(String currentUserId, String contactId) throws SQLException {
        String chatId = generateDirectChatId(currentUserId, contactId);

        try {
            if(!serviceManager.getMessageService().hasChatEncryption(chatId)) {
                PreKeyBundle bundle = serviceManager.getMessageService().getChatPreKeyBundle(chatId);
                serviceManager.getMessageService().initChatEncryption(chatId, bundle);
            }
        } catch(Exception err) {
            System.err.println("Failed to initialize direct chat encryption: " + err.getMessage());
        }

        Map<String, Object> res = new HashMap<>();
        res.put("chatId", chatId);
        res.put("fUserId", currentUserId);
        res.put("sUserId", contactId);
        res.put("encryptionInit", true);
        return res;
    }
}
