package com.app.main.root.app;
import com.app.main.root.app.EventLog.EventDirection;
import jakarta.annotation.PostConstruct;
import org.springframework.stereotype.Component;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.function.Consumer;
import java.util.*;

@Component
public class EventTracker {
    private static EventTracker instance;
    private final List<EventLog> logs = new CopyOnWriteArrayList<>();
    private List<Consumer<EventLog>> listeners = new CopyOnWriteArrayList<>();
    private final int maxLogs = 1000;

    @PostConstruct
    public void init() {
        System.out.println("Event Tracker initialized");
    }

    public void track(
        String eventName,
        Object data, 
        EventDirection direction,
        String senderId,
        String username
    ) {
        String id = generateId();
        Date timestamp = new Date();

        EventLog eventLogs = new EventLog(
            id, 
            eventName, 
            data, 
            timestamp, 
            direction, 
            senderId, 
            username
        );
        eventLogs.setId(id);
        eventLogs.setEventName(eventName);
        eventLogs.setData(data);
        eventLogs.setTimestamp(timestamp);
        eventLogs.setSenderId(senderId);
        eventLogs.setUsername(username);
        logs.add(eventLogs);

        if(logs.size() > maxLogs) {
            synchronized(eventLogs) {
                if(logs.size() > maxLogs) {
                    int excess = logs.size() - maxLogs;
                    logs.subList(0, excess).clear();
                }
            }
        }

        emitMessageEvent(eventLogs);
        //logToConsole(eventLogs);
    }

    /*
    **
    ***
    *** Get Logs
    ***
    **
    */
    public List<EventLog> getMessageLogs() {
        return new ArrayList<>(logs);
    }

    public List<EventLog> getLogsByEvent(String eventName) {
        List<EventLog> filtered = new ArrayList<>();
        for(EventLog log : logs) {
            if(eventName.equals(log.getEventName())) {
                filtered.add(log);
            }
        }
        return filtered;
    }

    public List<EventLog> getLogsByDirection(EventDirection direction) {
        List<EventLog> filtered = new ArrayList<>();
        for(EventLog log : logs) {
            if(direction == log.getDirection()) {
                filtered.add(log);
            }
        }
        return filtered;
    }

    public List<EventLog> getLogsByUser(String username) {
        List<EventLog> filtered = new ArrayList<>();
        for(EventLog log : logs) {
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
        logs.clear();
    }

    public int getLogCount() {
        return logs.size();
    }

    /*
    * Generate ID 
    */
    private String generateId() {
        String content = "evnt_" + System.currentTimeMillis() + "_" + UUID.randomUUID().toString().substring(0, 8);
        return content;
    }

    /*
    * Emitters 
    */
    private void emitMessageEvent(EventLog log) {
        for(Consumer<EventLog> listener : listeners) {
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

    private void emitChatEvent(EventLog log) {
        System.out.println(
            "Chat event tracked: " + log.getEventName() +
            " from user: " + log.getUsername()
        );
    }

    private void logToConsole(EventLog log) {
        String timestamp = new java.text.SimpleDateFormat("HH:mm:ss").format(log.getTimestamp());
        String direction = log.getDirection() == EventDirection.SENT ? "SENT" : "RECEIVED";
        String userInfo = log.getUsername() != null ? "(" + log.getUsername() + ")" : "no user";
        String colorCode = log.getDirection() == EventDirection.SENT ? "\u001B[32m" : "\u001B[34m";
        
        System.out.printf(
            "%s%s %s %s @ %s\u001B[0m%n", 
            colorCode, direction, log.getEventName(), userInfo, timestamp
        );
    }
}