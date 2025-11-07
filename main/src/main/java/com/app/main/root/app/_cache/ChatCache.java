package com.app.main.root.app._cache;
import com.app.main.root.app._types._Message;
import java.util.concurrent.locks.ReentrantReadWriteLock;
import java.util.*;

public class ChatCache {
    public final List<_Message> messages = new ArrayList<>();
    public final Set<Integer> loadedPages = new HashSet<>();
    public int totalMessageCount;
    public long lastAccessTime = System.currentTimeMillis();
    public boolean hasMore = true;
    public final ReentrantReadWriteLock lock = new ReentrantReadWriteLock();

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
