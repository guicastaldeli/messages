package com.app.main.root.app.main._messages_config;
import java.util.Date;

public class MessageLog {
    public enum MessageType {
        DIRECT,
        GROUP,
        SYSTEM
    }

    public enum MessageDirection {
        SENT,
        RECEIVED
    }

    private String messageId;
    private String content;
    private String senderId;
    private String username;
    private String chatId;
    private MessageType messageType;
    private MessageDirection direction;
    private Date timestamp;

    public MessageLog(
        String messageId,
        String content,
        String senderId,
        String username,
        String chatId,
        MessageType messageType,
        MessageDirection direction,
        Date timestamp
    ) {
        this.messageId = messageId;
        this.content = content;
        this.senderId = senderId;
        this.username = username;
        this.chatId = chatId;
        this.messageType = messageType;
        this.direction = direction;
        this.timestamp = timestamp;
    }

    @Override
    public String toString() {
        return String.format(
            """
                MessageLog{
                    messageId='%s',
                    username='%s',
                    chatId='%s',
                    senderId=%s,
                    username=%s,
                    type='%s',
                    direction='%s',
                    timestamp='%s',
                    content='%s'
                }        
            """,
            messageId,
            username,
            chatId,
            senderId,
            username,
            messageType,
            direction,
            timestamp,
            content
        );
    }

    /*
    * Get Id 
    */
    public void setMessageId(String id) {
        this.messageId = id;
    }
    public String getMessageId() {
        return messageId;
    }

    /*
    * Get Content 
    */
    public void setContent(String content) {
        this.content = content;
    }
    public String getContent() {
        return content;
    }

    /*
    * Get Sender Id
    */
    public void setSenderId(String id) {
        this.senderId = id;
    }
    public String getSenderId() {
        return senderId;
    }

    /*
    * Get Username  
    */
    public void setUsername(String username) {
        this.username = username;
    }
    public String getUsername() {
        return username;
    }

    /*
    * Get Chat Id 
    */
    public void setChatId(String id) {
        this.chatId = id;
    }
    public String getChatId() {
        return chatId;
    }

    /*
    * Get Type 
    */
    public void setMessageType(MessageType messageType) {
        this.messageType = messageType;
    }
    public MessageType getMessageType() {
        return messageType;
    }

    /*
    * Get Direction 
    */
    public void setDirection(MessageDirection direction) {
        this.direction = direction;
    }
    public MessageDirection getDirection() {
        return direction;
    }

    /*
    * Get Timestamp 
    */
    public void setTimestamp(Date timestamp) {
        this.timestamp = timestamp;
    }
    public Date getTimestamp() {
        return timestamp;
    }
}
