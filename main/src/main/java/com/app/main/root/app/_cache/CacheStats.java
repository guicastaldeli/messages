package com.app.main.root.app._cache;

public class CacheStats {
    public final int totalCachedChats;
    private final int totalCachedMessages;
    private final int totalLoadedPages;

    public CacheStats(
        int totalCachedChats,
        int totalCachedMessages,
        int totalLoadedPages
    ) {
        this.totalCachedChats = totalCachedChats;
        this.totalCachedMessages = totalCachedMessages;
        this.totalLoadedPages = totalLoadedPages;
    }
}
