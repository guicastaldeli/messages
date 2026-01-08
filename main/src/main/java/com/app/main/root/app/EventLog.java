package com.app.main.root.app;
import java.util.Date;

public class EventLog {
    public enum EventDirection {
        SENT,
        RECEIVED,
        PROCESSED,
        INTERNAL
    }

    private String id;
    private String eventName;
    private Object data;
    private Date timestamp;
    private EventDirection direction;
    private String senderId;
    private String username;

    public EventLog(
        String id,
        String eventName,
        Object data,
        Date timestamp,
        EventDirection direction,
        String senderId,
        String username
    ) {
        this.id = id;
        this.eventName = eventName;
        this.data = data;
        this.timestamp = timestamp;
        this.direction = direction;
        this.senderId = senderId;
        this.username = username;
    }

    /**
     * Id
     */
    public void setId(String id) {
        this.id = id;
    }
    public String getId() {
        return id;
    }

    /**
     * Event Name
     */
    public void setEventName(String eventName) {
        this.eventName = eventName;
    }
    public String getEventName() {
        return eventName;
    }

    /**
     * Data
     */
    public void setData(Object data) {
        this.data = data;
    }
    public Object getData() {
        return data;
    }

    /**
     * Timestamp
     */
    public void setTimestamp(Date timestamp) {
        this.timestamp = timestamp;
    }
    public Date getTimestamp() {
        return timestamp;
    }

    /**
     * Direction 
     */
    public void setDirection(EventDirection direction) {
        this.direction = direction;
    }
    public EventDirection getDirection() {
        return direction;
    }

    /**
     * Sender Id 
     */
    public void setSenderId(String senderId) {
        this.senderId = senderId;
    }
    public String getSenderId() {
        return senderId;
    }

    /**
     * Username
     */
    public void setUsername(String username) {
        this.username = username;
    }
    public String getUsername() {
        return username;
    }

    @Override
    public String toString() {
        return String.format(
            """
                EventLog{
                    id='%s',
                    eventName='%s',
                    direction='%s',
                    timestamp='%s'
                }    
            """,
            id,
            eventName,
            direction,
            timestamp
        );
    }
}
