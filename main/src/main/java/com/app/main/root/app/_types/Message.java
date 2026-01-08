package com.app.main.root.app._types;
import java.sql.Timestamp;

public class Message {
    private int id;
    private String chatId;
    private String senderId;
    private String content;
    private byte[] contentBytes;
    private String messageType;
    private Timestamp createdAt;
    private String username;
    private boolean isSystem;

    /**
     * Id
     */
    public void setId(int id) {
        this.id = id;
    }
    public int getId() {
        return id;
    }

    /**
     * Chat Id
     */
    public void setChatId(String chatId) {
        this.chatId = chatId;
    }
    public String getChatId() {
        return chatId;
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
     * Content
     */
    public void setContent(String content) {
        this.content = content;
    }
    public String getContent() {
        return content;
    }
    public void setContentBytes(byte[] content) {
        this.contentBytes = content;
    }
    public byte[] getContentBytes() {
        return contentBytes;
    }

    /**
     * Message Type
     */
    public void setMessageType(String messageType) {
        this.messageType = messageType;
    }
    public String getMessageType() {
        return messageType;
    }

    /**
     * Created At
     */
    public void setCreatedAt(Timestamp createdAt) {
        this.createdAt = createdAt;
    }
    public Timestamp getCreatedAt() {
        return createdAt;
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

    /**
     * System
     */
    public void setSystem(boolean isSystem) {
        this.isSystem = isSystem;
    }
    public boolean isSystem() {
        return isSystem;
    }
}
 