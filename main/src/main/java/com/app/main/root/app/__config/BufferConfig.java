package com.app.main.root.app.__config;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import org.springframework.stereotype.Component;
import java.lang.StringBuilder;

@Component
public class BufferConfig {
    private final Map<String, StringBuilder> messageBuffers = new ConcurrentHashMap<>();

    public String handleMessage(String sessionId, String partialMessage) {
        StringBuilder buffer = messageBuffers.computeIfAbsent(sessionId, k -> new StringBuilder());
        buffer.append(partialMessage);
        String completeMessage = buffer.toString();

        if(isCompleteJson(completeMessage)) {
            messageBuffers.remove(sessionId);
            return completeMessage;
        }

        return null;
    }

    private boolean isCompleteJson(String message) {
        if(message == null || message.trim().isEmpty()) {
            return false;
        }
        message = message.trim();

        int openBraces = 0;
        int openBrackets = 0;

        for(char c : message.toCharArray()) {
            if (c == '{') openBraces++;
            if (c == '}') openBraces--;
            if (c == '[') openBrackets++;
            if (c == ']') openBrackets--;
        }

        return openBraces == 0 && openBrackets == 0;
    }

    public void clearBuffer(String sessionId) {
        messageBuffers.remove(sessionId);
    }
}
