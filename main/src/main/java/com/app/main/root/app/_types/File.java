package com.app.main.root.app._types;

public class File {
    private String fileId;
    private String senderId;
    private String originalFileName;
    private Long fileSize;
    private String mimeType;
    private String fileType;
    private String chatId;
    private Object uploadedAt;
    private Object lastModified;

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
    public void setUploadedAt(Object uploadedAt) {
        this.uploadedAt = uploadedAt;
    }
    public Object getUploadedAt() {
        return uploadedAt;
    }

    /**
     * Last Modified
     */
    public void setLastModified(Object lastModified) {
        this.lastModified = lastModified;
    }
    public Object getLastModified() {
        return lastModified;
    }
}