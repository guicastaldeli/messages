package com.app.main.root.app._data;

public class MessageContext {
    public final String sessionId;
    public final String userId;
    public final String content;
    public final String messageId;
    public final String chatId;
    public final String targetUserId;
    public final String username;
    public final boolean isDirect;
    public final boolean isGroup;
    public final boolean isSystem;
    public final boolean isBroadcast;

    public MessageContext(
        String sessionId,
        String userId,
        String content,
        String messageId,
        String chatId,
        String targetUserId,
        String username,
        boolean isDirect,
        boolean isGroup,
        boolean isSystem,
        boolean isBroadcast
    ) {
        this.sessionId = sessionId;
        this.userId = userId;
        this.content = content;
        this.messageId = messageId;
        this.chatId = chatId;
        this.targetUserId = targetUserId;
        this.username = username;
        this.isDirect = isDirect;
        this.isGroup = isGroup;
        this.isSystem = isSystem;
        this.isBroadcast = isBroadcast;
    }
}