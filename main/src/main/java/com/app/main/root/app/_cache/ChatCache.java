package com.app.main.root.app._cache;
import com.app.main.root.app._types.Message;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.locks.ReentrantReadWriteLock;
import java.util.*;

public class ChatCache {
    private Map<String, ChatCache> chatCacheMap = new ConcurrentHashMap<>();
    public final Map<String, List<Message>> cachedPages = new ConcurrentHashMap<>();
    public final Set<Integer> loadedPages = ConcurrentHashMap.newKeySet();

    public final ReentrantReadWriteLock lock = new ReentrantReadWriteLock();
    public long lastAccessTime;
    public int totalMessages;

    public ChatCache(int totalMessages, Map<String, ChatCache> chatCacheMap) {
        this.chatCacheMap = chatCacheMap;
        this.totalMessages = totalMessages;
        this.lastAccessTime = System.currentTimeMillis();
    }

    public ReentrantReadWriteLock.ReadLock readLock() {
        return lock.readLock();
    }

    public ReentrantReadWriteLock.WriteLock writeLock() {
        return lock.writeLock();
    }

    public List<Message> getCachedMessages(String chatId, int page) {
        ChatCache cache = chatCacheMap.get(chatId);
        if(cache == null) return null;

        cache.readLock().lock();
        try {
            String pageKey = "page_" + page;
            return cache.cachedPages.get(pageKey);
        } finally {
            cache.readLock().unlock();
        }
    }

    public void cacheMessages(String chatId, int page, List<Message> messages) {
        ChatCache cache = chatCacheMap.computeIfAbsent(chatId, k -> new ChatCache(0, chatCacheMap));
        cache.writeLock().lock();

        try {
            String pageKey = "page_" + page;
            cache.cachedPages.put(pageKey, messages);
            cache.lastAccessTime = System.currentTimeMillis();
        } finally {
            cache.writeLock().unlock();
        }
    }

    public void invalidateMessageCache(String chatId) {
        chatCacheMap.remove(chatId);
    }
}
