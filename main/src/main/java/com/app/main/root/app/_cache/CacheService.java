package com.app.main.root.app._cache;
import com.app.main.root.app._types._Message;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.Executors;
import jakarta.annotation.PostConstruct;
import jakarta.annotation.PreDestroy;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;
import java.util.*;

@Service
public class CacheService {
    private ChatCache chatCache;
    private FileCache fileCache;

    private final Map<String, ChatCache> chatCacheMap = new ConcurrentHashMap<>();
    private final Map<String, FileCache> fileCacheMap = new ConcurrentHashMap<>();

    private ScheduledExecutorService cleanupExecutor = Executors.newScheduledThreadPool(1);

    @Value("${app.cache.pageSize:100}")
    private int pageSize;

    @Value("${app.cache.ttl.minutes:30}")
    private int cacheTtlMinutes;

    @PostConstruct
    public void init() {
        cleanupExecutor.scheduleAtFixedRate(this::cleanupExpiredEntries, 1, 1, TimeUnit.MINUTES);
    }

    @PreDestroy
    public void destroy() {
        cleanupExecutor.shutdown();
    }

    public Map<String, Object> getCachedChatData(String userId, String chatId, int page) {
        Map<String, Object> chatData = new HashMap<>();

        List<_Message> cachedMessages = chatCache.getCachedMessages(chatId, page);
        if(cachedMessages != null) {
            chatData.put("messages", cachedMessages);
            chatData.put("messagesFromCache", true);
        }
        List<Map<String, Object>> cachedFiles = fileCache.getCachedFilesPage(userId, chatId, page);
        if(cachedFiles != null) {
            chatData.put("files", cachedFiles);
            chatData.put("filesFromCache", true);
        }

        return chatData.isEmpty() ? null : chatData;
    }

    public void cacheChatData(
        String userId,
        String chatId,
        int page,
        List<_Message> messages,
        List<Map<String, Object>> files
    ) {
        if(messages != null) {
            chatCache.cacheMessages(chatId, page, messages);
        }
        if(files != null) {
            fileCache.cacheFilesPage(userId, chatId, page, files);
        }
    }

    
    /**
     * Cache Stats
     */
    public Map<String, Object> getCacheStats() {
        Map<String, Object> stats = new HashMap<>();
        stats.put("messageCaches", chatCacheMap.size());
        stats.put("fileCaches", fileCacheMap.size());
        stats.put("totalCachedPages", 
            chatCacheMap.values().stream().mapToInt(c -> c.cachedPages.size()).sum() +
            fileCacheMap.values().stream().mapToInt(c -> c.cachedPages.size()).sum()
        );
        return stats;
    }

    /**
     * Invalidate
     */
    public void invalidateChatCache(String userId, String chatId) {
        chatCache.invalidateMessageCache(chatId);
        fileCache.invalidateFileCache(userId, chatId);
    }
    

    private void cleanupExpiredEntries() {
        long currentTime = System.currentTimeMillis();
        long ttlMillis = cacheTtlMinutes * 60 * 1000L;

        chatCacheMap.entrySet().removeIf(entry ->
            currentTime - entry.getValue().lastAccessTime > ttlMillis
        );
        fileCacheMap.entrySet().removeIf(entry ->
            currentTime - entry.getValue().lastAccessTime > ttlMillis
        );
    }

    
    /**
     * Get Chat Cache
     */
    public ChatCache getChatCache() {
        return chatCache;
    }

    /**
     * Get File Cache
     */
    public FileCache getFileCache() {
        return fileCache;
    }
}
