package com.app.main.root.app._data;
import com.app.main.root.app._types._Message;
import java.sql.Timestamp;

public class EncryptedMessageData {
    private Integer id;
    private String chatId;
    private String senderId;
    private String content;
    private byte[] contentBytes;
    private String messageType;
    private Timestamp createdAt;
    private String username;
    private boolean system;
    private boolean isEncrypted;

    public EncryptedMessageData() {}
    public EncryptedMessageData(_Message message, boolean isEncrypted) {
        this.id = message.getId();
        this.chatId = message.getChatId();
        this.senderId = message.getSenderId();
        this.messageType = message.getMessageType();
        this.createdAt = message.getCreatedAt();
        this.username = message.getUsername();
        this.system = message.isSystem();
        this.isEncrypted = isEncrypted;
        this.contentBytes = message.getContentBytes();

        if(isEncrypted) {
            this.content = bytesToUnicodeString(message.getContentBytes());
        } else {
            this.content = message.getContent();
        }
    }

    /*
    * Bytes to Unicode String 
    */
    private String bytesToUnicodeString(byte[] bytes) {
        if(bytes == null) return "";
        StringBuilder sb = new StringBuilder();
        for (byte b : bytes) {
            int unsignedByte = b & 0xFF;
            sb.append(String.format("%02x", unsignedByte));
        }
        return sb.toString();
    }

    public Integer getId() { 
        return id; 
    }
    public void setId(Integer id) { 
        this.id = id; 
    }

    public String getChatId() { 
        return chatId; 
    }
    public void setChatId(String chatId) { 
        this.chatId = chatId; 
    }

    public String getSenderId() { 
        return senderId; 
    }
    public void setSenderId(String senderId) { 
        this.senderId = senderId; 
    }

    public void setContent(String content) {
        this.content = content;
    }
    public String getContent() {
        return content;
    }
    public byte[] getContentBytes() { 
        return contentBytes; 
    }
    public void setContentBytes(byte[] contentBytes) { 
        this.contentBytes = contentBytes; 
    }

    public String getMessageType() { 
        return messageType; 
    }
    public void setMessageType(String messageType) { 
        this.messageType = messageType; 
    }

    public Timestamp getCreatedAt() { 
        return createdAt; 
    }
    public void setCreatedAt(Timestamp createdAt) { 
        this.createdAt = createdAt; 
    }

    public String getUsername() { 
        return username; 
    }
    public void setUsername(String username) { 
        this.username = username; 
    }

    public boolean isSystem() { 
        return system; 
    }
    public void setSystem(boolean system) { 
        this.system = system; 
    }

    public boolean isEncrypted() { 
        return isEncrypted; 
    }
    public void setEncrypted(boolean encrypted) { 
        isEncrypted = encrypted; 
    }
}
