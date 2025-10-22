package com.app.main.root.app._data;

public class MessageContext {
    public final String sessionId;
    public final String content;
    public final String chatId;
    public final String targetUserId;
    public final String username;
    public final boolean isDirect;
    public final boolean isGroup;
    public final boolean isBroadcast;

    public MessageContext(
        String sessionId,
        String content,
        String chatId,
        String targetUserId,
        String username,
        boolean isDirect,
        boolean isGroup,
        boolean isBroadcast
    ) {
        this.sessionId = sessionId;
        this.content = content;
        this.chatId = chatId;
        this.targetUserId = targetUserId;
        this.username = username;
        this.isDirect = isDirect;
        this.isGroup = isGroup;
        this.isBroadcast = isBroadcast;
    }
}
