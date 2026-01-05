package com.app.main.root.app._types;

public class File {
    private String fileId;
    private String messageId;
    private String senderId;
    private String originalFileName;
    private Long fileSize;
    private String mimeType;
    private String fileType;
    private String chatId;
    private Long uploadedAt;
    private Long lastModified;
    private byte[] iv;
    private byte[] tag;

    /**
     * File Id
     */
    public void setFileId(String fileId) {
        this.fileId = fileId;
    }
    public String getFileId() {
        return fileId;
    }

    /**
     * Message Id
     */
    public void setMessageId(String messageId) {
        this.messageId = messageId;
    }
    public String getMessageId() {
        return messageId;
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
     * Original File Name
     */
    public void setOriginalFileName(String originalFileName) {
        this.originalFileName = originalFileName;
    }
    public String getOriginalFileName() {
        return originalFileName;
    }

    /**
     * File Size
     */
    public void setFileSize(Long fileSize) {
        this.fileSize = fileSize;
    }
    public Long getFileSize() {
        return fileSize;
    }

    /**
     * Mime Type
     */
    public void setMimeType(String mimeType) {
        this.mimeType = mimeType;
    }
    public String getMimeType() {
        return mimeType;
    }

    /**
     * File Type
     */
    public void setFileType(String fileType) {
        this.fileType = fileType;
    }
    public String getFileType() {
        return fileType;
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
     * Uploaded At
     */
    public void setUploadedAt(Long uploadedAt) {
        this.uploadedAt = uploadedAt;
    }
    public Object getUploadedAt() {
        return uploadedAt;
    }

    /**
     * Last Modified
     */
    public void setLastModified(Long lastModified) {
        this.lastModified = lastModified;
    }
    public Object getLastModified() {
        return lastModified;
    }

    /**
     * Iv
     */
    public byte[] getIv() {
        return iv;
    }
    public void setIv(byte[] iv) {
        this.iv = iv;
    }
    
    /**
     * Tag
     */
    public byte[] getTag() {
        return tag;
    }
    public void setTag(byte[] tag) {
        this.tag = tag;
    }
}