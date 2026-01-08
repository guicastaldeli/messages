package com.app.main.root.app._types;
import java.sql.Timestamp;

public class RecentChat {
    private String chatId;
    private Timestamp lastMessageTime;
    private String lastMessage;
    private String lastSender;
    private String chatType;
    private String chatName;
    
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
     * Last Message
     */
    public void setLastMessage(String lastMessage) {
        this.lastMessage = lastMessage;
    }
    public String getLastMessage() {
        return lastMessage;
    }
 
    /**
     * Last Message Time
     */
    public void setLastMessageTime(Timestamp lastMessageTime) {
        this.lastMessageTime = lastMessageTime;
    }
    public Timestamp getLastMessageTime() {
        return lastMessageTime;
    }

    /**
     * Last Sender
     */
    public void setLastSender(String lastSender) {
        this.lastSender = lastSender;
    }
    public String getLastSender() {
        return lastSender;
    }

    /**
     * Chat Type
     */
    public void setChatType(String chatType) {
        this.chatType = chatType;
    }
    public String getChatType() {
        return chatType;
    }

    /**
     * Chat Name
     */
    public void setChatName(String chatName) {
        this.chatName = chatName;
    }
    public String getChatName() {
        return chatName;
    }
}