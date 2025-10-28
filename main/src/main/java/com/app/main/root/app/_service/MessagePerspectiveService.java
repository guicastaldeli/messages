package com.app.main.root.app._service;
import com.app.main.root.app._data.MessagePerspectiveDetector;
import com.app.main.root.app._data.MessagePerspectiveResult;
import org.springframework.stereotype.Component;
import java.util.*;

@Component
public class MessagePerspectiveService {
    private final MessagePerspectiveDetector perspectiveDetector;

    public MessagePerspectiveService(MessagePerspectiveDetector perspectiveDetector) {
        this.perspectiveDetector = perspectiveDetector;
    }

    public Map<String, Object> applyPerspective(
        String sessionId,
        Map<String, Object> message
    ) {
        MessagePerspectiveResult perspective = perspectiveDetector.detectPerspective(sessionId, message);

        Map<String, Object> result = new HashMap<>(message);
        Map<String, Object> perspectiveMap = new HashMap<>();
        perspectiveMap.put("direction", perspective.getDirection());
        perspectiveMap.put("perspectiveType", perspective.getPerpspectiveType());
        perspectiveMap.put("showUsername", perspective.getRenderConfig().get("showUsername"));
        perspectiveMap.put("displayUsername", perspective.getRenderConfig().get("displayUsername"));
        perspectiveMap.put("isCurrentUser", perspective.getMetadata().get("isCurrentUser"));
        perspectiveMap.put("isDirect", perspective.getMetadata().get("isDirect"));
        perspectiveMap.put("isGroup", perspective.getMetadata().get("isGroup"));
        perspectiveMap.put("isSystem", perspective.getMetadata().get("isSystem"));
        perspectiveMap.put("isAboutCurrentUser", perspectiveDetector.isAboutCurrentUser(perspectiveMap, sessionId));
        result.put("_perspective", perspectiveMap);

        return result;
    }
}
