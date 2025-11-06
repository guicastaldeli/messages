package com.app.main.root.app._cache;
import com.app.main.root.app._types._Message;
import java.util.concurrent.locks.ReentrantReadWriteLock;
import java.util.*;

public class ChatCache {
    private final List<_Message> messages = new ArrayList<>();
    private final Set<Integer> loadedPages = new HashSet<>();
    private int totalMessageCount;
    private long lastAccessTime = System.currentTimeMillis();
    private boolean hasMore = true;
    private final ReentrantReadWriteLock lock = new ReentrantReadWriteLock();

    public ChatCache(int totalMessageCount) {
        this.totalMessageCount = totalMessageCount;
    }

    public ReentrantReadWriteLock.ReadLock readLock() {
        return lock.readLock();
    }

    public ReentrantReadWriteLock.WriteLock writeLock() {
        return lock.writeLock();
    }
}
