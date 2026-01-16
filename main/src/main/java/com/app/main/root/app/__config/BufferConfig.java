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
        
        if(!message.startsWith("{") && !message.startsWith("[")) {
            return false;
        }

        return isValidJsonStructure(message);
    }

    private boolean isValidJsonStructure(String message) {
        int length = message.length();
        int index = 0;
        boolean inString = false;
        boolean escaped = false;
        char stringDelimiter = '\0';
        
        java.util.Stack<Character> stack = new java.util.Stack<>();

        while(index < length) {
            char c = message.charAt(index);
            
            if(escaped) {
                escaped = false;
                index++;
                continue;
            }

            if(inString) {
                if(c == '\\') {
                    escaped = true;
                } else if(c == stringDelimiter) {
                    inString = false;
                    stringDelimiter = '\0';
                }
                index++;
                continue;
            }

            switch (c) {
                case '"':
                case '\'':
                    inString = true;
                    stringDelimiter = c;
                    break;
                case '{':
                case '[':
                    stack.push(c);
                    break;
                case '}':
                    if(stack.isEmpty() || stack.pop() != '{') {
                        return false;
                    }
                    break;
                case ']':
                    if(stack.isEmpty() || stack.pop() != '[') {
                        return false;
                    }
                    break;
            }
            index++;
        }

        return stack.isEmpty() && !inString;
    }

    public void clearBuffer(String sessionId) {
        messageBuffers.remove(sessionId);
    }
}