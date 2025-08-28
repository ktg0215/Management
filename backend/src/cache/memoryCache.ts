interface CacheEntry<T> {
  data: T;
  expiry: number;
  hitCount: number;
  lastAccessed: number;
}

class MemoryCache {
  private cache = new Map<string, CacheEntry<any>>();
  private maxSize: number;
  private defaultTTL: number;
  private cleanupInterval: NodeJS.Timeout;

  constructor(maxSize: number = 1000, defaultTTL: number = 3600) {
    this.maxSize = maxSize;
    this.defaultTTL = defaultTTL;
    
    // Clean up expired entries every 5 minutes
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 5 * 60 * 1000);
  }

  private cleanup(): void {
    const now = Date.now();
    const entries = Array.from(this.cache.entries());
    
    // Remove expired entries
    for (const [key, entry] of entries) {
      if (entry.expiry < now) {
        this.cache.delete(key);
      }
    }

    // If still over size limit, remove least recently used entries
    if (this.cache.size > this.maxSize) {
      const sortedEntries = Array.from(this.cache.entries())
        .sort((a, b) => a[1].lastAccessed - b[1].lastAccessed);
      
      const removeCount = this.cache.size - this.maxSize;
      for (let i = 0; i < removeCount; i++) {
        this.cache.delete(sortedEntries[i][0]);
      }
    }
  }

  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    
    if (!entry) {
      return null;
    }

    if (entry.expiry < Date.now()) {
      this.cache.delete(key);
      return null;
    }

    // Update access statistics
    entry.hitCount++;
    entry.lastAccessed = Date.now();
    
    return entry.data;
  }

  set<T>(key: string, data: T, ttlSeconds?: number): boolean {
    const ttl = ttlSeconds || this.defaultTTL;
    const expiry = Date.now() + (ttl * 1000);
    
    this.cache.set(key, {
      data,
      expiry,
      hitCount: 0,
      lastAccessed: Date.now()
    });

    return true;
  }

  has(key: string): boolean {
    const entry = this.cache.get(key);
    
    if (!entry) {
      return false;
    }

    if (entry.expiry < Date.now()) {
      this.cache.delete(key);
      return false;
    }

    return true;
  }

  delete(key: string): boolean {
    return this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }

  size(): number {
    return this.cache.size;
  }

  getStats(): any {
    const entries = Array.from(this.cache.values());
    const totalHits = entries.reduce((sum, entry) => sum + entry.hitCount, 0);
    const now = Date.now();
    const expired = entries.filter(entry => entry.expiry < now).length;

    return {
      totalEntries: this.cache.size,
      maxSize: this.maxSize,
      totalHits,
      expiredEntries: expired,
      memoryUsage: process.memoryUsage().heapUsed
    };
  }

  invalidatePattern(pattern: string): number {
    const regex = new RegExp(pattern.replace(/\*/g, '.*'));
    let deletedCount = 0;

    for (const key of this.cache.keys()) {
      if (regex.test(key)) {
        this.cache.delete(key);
        deletedCount++;
      }
    }

    return deletedCount;
  }

  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.clear();
  }
}

export const memoryCache = new MemoryCache(500, 1800); // 500 entries, 30 min TTL
export default memoryCache;