package com.app.main.root.app._cache;

public class PageInfo {
    public final boolean isLoaded;
    public final boolean hasMore;
    public final int totalMessages;

    public PageInfo(
        boolean isLoaded,
        boolean hasMore,
        int totalMessages 
    ) {
        this.isLoaded = isLoaded;
        this.hasMore = hasMore;
        this.totalMessages = totalMessages;
    }
}
