package com.app.main.root.app.main._messages_config;
import com.app.main.root.app.main._messages_config.MessageLog.MessageDirection;

import org.springframework.stereotype.Component;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.function.Consumer;
import java.util.*;

@Component
public class MessageTracker {
    private static MessageTracker instance;
    private final List<MessageLog> messageLogs = new CopyOnWriteArrayList<>();
    private List<Consumer<MessageLog>> messageListeners = new CopyOnWriteArrayList<>();
    private final int maxLogs = 1000;

    public static MessageTracker getInstance() {
        if(instance == null) {
            synchronized(MessageTracker.class) {
                if(instance == null) {
                    instance = new MessageTracker();
                }
            }
        }
        return instance;
    }

    public void trackMessage(
        String eventName,
        Object data, 
        MessageDirection direction,
        String senderId,
        String username
    ) {
        String id = generateId();
        Date timestamp = new Date();

        MessageLog messageLog = new MessageLog(
            id, 
            eventName, 
            data, 
            timestamp, 
            direction, 
            senderId, 
            username
        );
        messageLog.setId(id);
        messageLog.setEventName(eventName);
        messageLog.setData(data);
        messageLog.setTimestamp(timestamp);
        messageLog.setSenderId(senderId);
        messageLog.setUsername(username);
        messageLogs.add(messageLog);

        if(messageLogs.size() > maxLogs) {
            synchronized(messageLogs) {
                if(messageLogs.size() > maxLogs) {
                    int excess = messageLogs.size() - maxLogs;
                    messageLogs.subList(0, excess).clear();
                }
            }
        }

        emitMessageEvent(messageLog);
        logToConsole(messageLog);
    }

    /*
    **
    ***
    *** Get Logs
    ***
    **
    */
    public List<MessageLog> getMessageLogs() {
        return new ArrayList<>(messageLogs);
    }

    public List<MessageLog> getMessageLogsByEvent(String eventName) {
        List<MessageLog> filtered = new ArrayList<>();
        for(MessageLog log : messageLogs) {
            if(eventName.equals(log.getEventName())) {
                filtered.add(log);
            }
        }
        return filtered;
    }

    public List<MessageLog> getMessageLogsByDirection(MessageDirection direction) {
        List<MessageLog> filtered = new ArrayList<>();
        for(MessageLog log : messageLogs) {
            if(direction == log.getDirection()) {
                filtered.add(log);
            }
        }
        return filtered;
    }

    public List<MessageLog> getMessageLogsByUser(String username) {
        List<MessageLog> filtered = new ArrayList<>();
        for(MessageLog log : messageLogs) {
            if(username.equals(log.getUsername())) {
                filtered.add(log);
            }
        }
        return filtered;
    }

    /*
    * Utils
    */
    public void clearLogs() {
        messageLogs.clear();
    }

    public int getLogCount() {
        return messageLogs.size();
    }

    /*
    * Generate ID 
    */
    private String generateId() {
        String content = "msg_" + System.currentTimeMillis() + "_" + UUID.randomUUID().toString().substring(0, 8);
        return content;
    }

    /*
    * Emitters 
    */
    private void emitMessageEvent(MessageLog log) {
        for(Consumer<MessageLog> listener : messageListeners) {
            try {
                listener.accept(log);
            } catch(Exception err) {
                System.err.println("Error in message listener: " + err.getMessage());
            }
        }

        if(
            "chat".equals(log.getEventName()) || 
            "new-message".equals(log.getEventName())
        ) {
            emitChatEvent(log);
        }
    }

    private void emitChatEvent(MessageLog log) {
        System.out.println(
            "Chat event tracked: " + log.getEventName() +
            " from user: " + log.getUsername()
        );
    }

    private void logToConsole(MessageLog log) {
        String timestamp = new java.text.SimpleDateFormat("HH:mm:ss").format(log.getTimestamp());
        String direction = log.getDirection() == MessageDirection.SENT ? "SENT" : "RECEIVED";
        String userInfo = log.getUsername() != null ? "(" + log.getUsername() + ")" : "no user";
        String colorCode = log.getDirection() == MessageDirection.SENT ? "\u001B[32m" : "\u001B[34m";
        
        System.out.printf(
            "%s%s %s %s @ %s\u001B[0m%n", 
            colorCode, direction, log.getEventName(), userInfo, timestamp
        );
        
    }
}