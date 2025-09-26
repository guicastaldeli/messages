package com.app.main.root.app._db.types;
import java.sql.Timestamp;

public class _Message {
    private int id;
    private String chatId;
    private String senderId;
    private String content;
    private String messageType;
    private Timestamp createdAt;
    private String username;

    /*
    * ID 
    */
    public void setId(int id) {
        this.id = id;
    }
    public int getId() {
        return id;
    }

    /*
    * Chat ID 
    */
    public void setChatId(String chatId) {
        this.chatId = chatId;
    }
    public String getChatId() {
        return chatId;
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
    * Content
    */
    public void setContent(String content) {
        this.content = content;
    }
    public String getContent() {
        return content;
    }

    /*
    * Message Type
    */
    public void setMessageType(String messageType) {
        this.messageType = messageType;
    }
    public String getMessageType() {
        return messageType;
    }

    /*
    * Created At
    */
    public void setCreatedAt(Timestamp createdAt) {
        this.createdAt = createdAt;
    }
    public Timestamp getCreatedAt() {
        return createdAt;
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
}
 