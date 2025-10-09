package com.app.main.root.app.main._messages_config;
import com.app.main.root.app.main._messages_config.MessageLog.*;
import org.springframework.stereotype.Component;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.stream.Collectors;
import java.text.SimpleDateFormat;
import java.util.*;

@Component
public class MessageTracker {
    private static MessageTracker instance;
    private final List<MessageLog> logs = new CopyOnWriteArrayList<>();
    private final int maxMessages = 5000;

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

    public void track(
        String messageId,
        String content,
        String senderId,
        String username,
        String chatId,
        MessageType messageType,
        MessageDirection direction
    ) {
        Date timetamp = new Date();

        MessageLog messageLog = new MessageLog(
            messageId,
            content,
            senderId,
            username,
            chatId,
            messageType,
            direction,
            timetamp
        );
        logs.add(messageLog);

        if(logs.size() > maxMessages) {
            synchronized(logs) {
                if(logs.size() > maxMessages) {
                    int excess = logs.size() - maxMessages;
                    logs.subList(0, excess).clear();
                }
            }
        }

        logMessageToConsole(messageLog);
    }

    /*
    * Getters 
    */
    public List<MessageLog> getAllMessages() {
        return new ArrayList<>(logs);
    }

    public List<MessageLog> getMessagesByUser(String username) {
        return logs.stream()
            .filter(log -> username.equals(log.getUsername()))
            .collect(Collectors.toList());
    }

    public List<MessageLog> getMessagesByChatId(String chatId) {
        return logs.stream()
            .filter(log -> chatId.equals(log.getChatId()))
            .collect(Collectors.toList());
    }

    public List<MessageLog> getMessagesByType(MessageType type) {
        return logs.stream()
            .filter(log -> type == log.getMessageType())
            .collect(Collectors.toList());
    }

    public List<MessageLog> getMessagesByDirection(MessageDirection direction) {
        return logs.stream()
            .filter(log -> direction == log.getDirection())
            .collect(Collectors.toList());
    }

    public List<MessageLog> getRecentMessages(int count) {
        int startIndex = Math.max(0, logs.size() - count);
        return new ArrayList<>(logs.subList(startIndex, logs.size()));
    }

    public int getMessageCount() {
        return logs.size();
    }

    /*
    * Clear Messages 
    */
    public void clearMessages() {
        logs.clear();
    }

    public Map<String, Long> getMessageStats() {
        Map<String, Long> stats = new HashMap<>();

        //Direct
        long directCount = logs.stream()
        .filter(log -> log.getMessageType() == MessageType.DIRECT)
        .count();

        //Group
        long groupCount = logs.stream()
        .filter(log -> log.getMessageType() == MessageType.GROUP)
        .count();

        //Sended
        long sentCount = logs.stream()
        .filter(log -> log.getDirection() == MessageDirection.SENT)
        .count();

        //Received
        long receivedCount = logs.stream()
        .filter(log -> log.getDirection() == MessageDirection.RECEIVED)
        .count();

        stats.put("total", (long) logs.size());
        stats.put("direct", directCount);
        stats.put("group", groupCount);
        stats.put("sent", sentCount);
        stats.put("received", receivedCount);
        return stats;
    }

    /*
    * Log to Console 
    */
    private void logMessageToConsole(MessageLog log) {
        String timestamp = new SimpleDateFormat("HH:mm:ss").format(log.getTimestamp());
        String direction = log.getDirection() == MessageDirection.SENT ? "SENT" : "RECEIVED";
        String type = log.getMessageType() == MessageType.DIRECT ? "DIRECT" : "GROUP";
        String username = log.getUsername();
        String chatId = log.getChatId();

        System.out.printf(
            direction, type, username, chatId, timestamp
        );
    }
}
