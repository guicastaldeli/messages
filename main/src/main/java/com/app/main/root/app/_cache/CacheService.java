package com.app.main.root.app._cache;
import com.app.main.root.app._types._Message;

import jakarta.annotation.PreDestroy;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;
import java.util.*;

@Service
public class CacheService {
    private final Map<String, ChatCache> cache = new ConcurrentHashMap<>();
    private ScheduledExecutorService cleanupExecutor = Executors.newScheduledThreadPool(1);

    @Value("${app.cache.pageSize:100}")
    private int pageSize;

    @Value("${app.cache.maxPagesPerChat:20}")
    private int maxPagesPerChat;

    @Value("${app.cache.evictionTimeMinutes:60}")
    private int evictionTimeMinutes;

    public CacheService() {
        cleanupExecutor.scheduleAtFixedRate(
            this::cleanupExpired,
            30,
            30,
            TimeUnit.MINUTES
        );
    }

    public void initChatCache(String chatId, int totalMessageCount) {
        cache.computeIfAbsent(chatId, id -> new ChatCache(totalMessageCount));
        enforceSizeLimits();
    }

    public void cacheMessages(String chatId, List<_Message> messages, int page) {
        ChatCache chatCache = cache.get(chatId);
        if(chatCache == null) {
            chatCache = new ChatCache(messages.size() + (page * pageSize));
            cache.put(chatId, chatCache);
        }
        chatCache.writeLock().lock();

        try {
            int startIndex = page * pageSize;
            while(chatCache.messages.size() < startIndex + messages.size()) {
                chatCache.messages.add(null);
            }
            for(int i = 0; i < messages.size(); i++) {
                chatCache.messages.set(startIndex + i, messages.get(i));
            }

            chatCache.loadedPages.add(page);
            chatCache.lastAccessTime = System.currentTimeMillis();
            chatCache.hasMore = chatCache.messages.size() < chatCache.totalMessageCount;
        } finally {
            chatCache.writeLock().unlock();
        }

        enforceSizeLimits();
    }

    public Optional<List<_Message>> getCachedPage(String chatId, int page) {
        ChatCache chatCache = cache.get(chatId);
        if(chatCache == null) return Optional.empty();
        chatCache.readLock().lock();

        try {
            if(
                !chatCache.loadedPages.contains(page) ||
                !isPageComplete(chatCache, page)
            ) {
                return Optional.empty();
            }

            chatCache.lastAccessTime = System.currentTimeMillis();
            int startIndex = page * pageSize;
            int endIndex = Math.min(startIndex + pageSize, chatCache.messages.size());

            List<_Message> pageMessages = new ArrayList<>();
            for(int i = startIndex; i < endIndex; i++) {
                _Message message = chatCache.messages.get(i);
                if(message != null) {
                    pageMessages.add(message);
                }
            }

            return Optional.of(pageMessages);
        } finally {
            chatCache.readLock().unlock();
        }
    }

    public void addMessageToCache(String chatId, _Message message) {
        ChatCache chatCache = cache.get(chatId);
        if(chatCache == null) {
            chatCache = new ChatCache(1);
            cache.put(chatId, chatCache);
        }
        chatCache.writeLock().lock();

        try {
            chatCache.messages.add(message);
            chatCache.totalMessageCount++;

            int lastPage = (chatCache.messages.size() - 1) / pageSize;
            chatCache.loadedPages.add(lastPage);
            chatCache.lastAccessTime = System.currentTimeMillis();
        } finally {
            chatCache.writeLock().unlock();
        }
    }

    public PageInfo getPageInfo(String chatId, int page) {
        ChatCache chatCache = cache.get(chatId);
        if(chatCache == null) return new PageInfo(false, false, 0);
        chatCache.readLock().lock();

        try {
            boolean isLoaded = 
                chatCache.loadedPages.contains(page) &&
                isPageComplete(chatCache, page);
            boolean hasMore = chatCache.hasMore;
            int totalMessages = chatCache.totalMessageCount;
            return new PageInfo(isLoaded, hasMore, totalMessages);
        } finally {
            chatCache.readLock().unlock();
        }
    }

    public List<Integer> getMissingPages(
        String chatId,
        int startPage,
        int endPage
    ) {
        ChatCache chatCache = cache.get(chatId);
        if(chatCache == null) {
            List<Integer> allPages = new ArrayList<>();
            for(int i = startPage; i <= endPage; i++) allPages.add(i);
            return allPages;
        }
        chatCache.readLock().lock();

        try {
            List<Integer> missingPages = new ArrayList<>();
            for(int page = startPage; page <= endPage; page++) {
                if(
                    !chatCache.loadedPages.contains(page) ||
                    !isPageComplete(chatCache, page)
                ) {
                    missingPages.add(page);
                }
            }
            return missingPages;
        } finally {
            chatCache.readLock().unlock();
        }
    }

    private boolean isPageComplete(ChatCache chatCache, int page) {
        int startIndex = page * pageSize;
        int endIndex = Math.min(startIndex + pageSize, chatCache.messages.size());
        for(int i = startIndex; i < endIndex; i++) {
            if(chatCache.messages.get(i) == null) {
                return false;
            }
        }
        return true;
    }

    private void enforceSizeLimits() {
        List<Map.Entry<String, ChatCache>> sortedEntries = new ArrayList<>(cache.entrySet());
        sortedEntries.sort(Comparator.comparingLong(entry -> entry.getValue().lastAccessTime));
    }

    @PreDestroy
    public void destroy() {
        cleanupExecutor.shutdown();
    }

    private void cleanupExpired() {
        long cuttoffTime = 
            System.currentTimeMillis() -
            TimeUnit.MINUTES.toMillis(evictionTimeMinutes);

        Iterator<Map.Entry<String, ChatCache>> iterator = cache.entrySet().iterator();
        while(iterator.hasNext()) {
            Map.Entry<String, ChatCache> entry = iterator.next();
            if(entry.getValue().lastAccessTime < cuttoffTime) {
                iterator.remove();
            }
        }
    }
}
