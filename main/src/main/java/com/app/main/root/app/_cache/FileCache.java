package com.app.main.root.app._cache;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.locks.ReentrantReadWriteLock;
import java.util.*;

public class FileCache {
    private Map<String, FileCache> fileCacheMap = new ConcurrentHashMap<>();
    public final Map<String, List<Map<String, Object>>> cachedPages = new ConcurrentHashMap<>();
    public final Set<String> loadedPages = ConcurrentHashMap.newKeySet();

    public final ReentrantReadWriteLock lock = new ReentrantReadWriteLock();
    public long lastAccessTime;
    public int totalFileCount;

    public FileCache(int totalFileCount, Map<String, FileCache> fileCacheMap) {
        this.fileCacheMap = fileCacheMap;
        this.totalFileCount = totalFileCount;
    }

    public ReentrantReadWriteLock.ReadLock readLock() {
        return lock.readLock();
    }

    public ReentrantReadWriteLock.WriteLock writeLock() {
        return lock.writeLock();
    }

    public List<Map<String, Object>> getCachedFilesPage(String userId, String chatId, int page) {
        String cacheKey = userId + "_" + chatId;
        
        synchronized(fileCacheMap) {
            FileCache cache = fileCacheMap.get(cacheKey);
            if(cache == null) return null;
            
            cache.readLock().lock();
            try {
                String pageKey = chatId + "_page_" + page;
                return cache.cachedPages.get(pageKey);
            } finally {
                cache.readLock().unlock();
            }
        }
    }

    /**
     * Cache Files Page
     */
    public void cacheFilesPage(String userId, String chatId, int page, List<Map<String, Object>> files) {
        String cacheKey = userId + "_" + chatId;
        
        synchronized(fileCacheMap) {
            FileCache cache = fileCacheMap.computeIfAbsent(cacheKey, k -> new FileCache(0, fileCacheMap));
            cache.writeLock().lock();
            
            try {
                String pageKey = chatId + "_page_" + page;
                cache.cachedPages.put(pageKey, files);
                cache.loadedPages.add(pageKey);
                cache.lastAccessTime = System.currentTimeMillis();
            } finally {
                cache.writeLock().unlock();
            }
        }
    }

    /**
     * Invalidate
     */
    public void invalidateFileCache(String userId, String chatId) {
        String cacheKey = userId + "_" + chatId;
        fileCacheMap.remove(cacheKey);
    }
}