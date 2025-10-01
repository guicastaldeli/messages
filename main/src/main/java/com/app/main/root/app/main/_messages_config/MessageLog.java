package com.app.main.root.app.main._messages_config;
import java.util.Date;

public class MessageLog {
    public enum MessageDirection {
        SENT,
        RECEIVED
    }

    private String id;
    private String eventName;
    private Object data;
    private Date timestamp;
    private MessageDirection direction;
    private String senderId;
    private String username;

    public MessageLog(
        String id,
        String eventName,
        Object data,
        Date timestamp,
        MessageDirection direction,
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

    /*
    * ID 
    */
    public void setId(String id) {
        this.id = id;
    }
    public String getId() {
        return id;
    }

    /*
    * Event Name 
    */
    public void setEventName(String eventName) {
        this.eventName = eventName;
    }
    public String getEventName() {
        return eventName;
    }

    /*
    * Data 
    */
    public void setData(Object data) {
        this.data = data;
    }
    public Object getData() {
        return data;
    }

    /*
    * Timestamp 
    */
    public void setTimestamp(Date timestamp) {
        this.timestamp = timestamp;
    }
    public Date getTimestamp() {
        return timestamp;
    }

    /*
    * Message Direction 
    */
    public void setDirection(MessageDirection direction) {
        this.direction = direction;
    }
    public MessageDirection getDirection() {
        return direction;
    }

    /*
    * Sender ID 
    */
    public void setSenderId(String senderId) {
        this.senderId = senderId;
    }
    public String getSenderId() {
        return senderId;
    }

    /*
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
                MessageLog{
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
