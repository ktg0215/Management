import Redis from 'ioredis';
import { logger } from '../utils/logger';

interface CacheOptions {
  ttl?: number; // Time to live in seconds
  prefix?: string;
  compress?: boolean;
  tags?: string[];
}

interface CacheStats {
  hits: number;
  misses: number;
  sets: number;
  deletes: number;
  errors: number;
  hitRate: number;
}

class CacheService {
  private redis: Redis | null = null;
  private defaultTTL = 3600; // 1 hour default
  private keyPrefix = 'sales_management:';
  private stats: CacheStats = {
    hits: 0,
    misses: 0,
    sets: 0,
    deletes: 0,
    errors: 0,
    hitRate: 0
  };

  constructor() {
    this.initializeRedis();
  }

  private initializeRedis() {
    try {
      const redisConfig = {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
        password: process.env.REDIS_PASSWORD,
        db: parseInt(process.env.REDIS_DB || '0'),
        
        // Connection optimization
        maxRetriesPerRequest: 3,
        retryDelayOnFailover: 100,
        lazyConnect: true,
        keepAlive: 30000,
        
        // Connection pool
        family: 4,
        
        // Key naming
        keyPrefix: this.keyPrefix,
      };

      this.redis = new Redis(redisConfig);

      this.redis.on('connect', () => {
        logger.logInfo('Redis connected successfully');
      });

      this.redis.on('error', (error) => {
        this.stats.errors++;
        logger.logError('Redis connection error', error);
        this.redis = null; // Disable caching on error
      });

      this.redis.on('close', () => {
        logger.logInfo('Redis connection closed');
      });

    } catch (error) {
      console.error('❌ Failed to initialize Redis:', error);
      this.redis = null;
    }
  }

  private generateKey(key: string, prefix?: string): string {
    return prefix ? `${prefix}:${key}` : key;
  }

  private updateHitRate(): void {
    const total = this.stats.hits + this.stats.misses;
    this.stats.hitRate = total > 0 ? (this.stats.hits / total) * 100 : 0;
  }

  async get<T>(key: string, options?: CacheOptions): Promise<T | null> {
    const startTime = Date.now();
    
    if (!this.redis) {
      this.stats.misses++;
      return null;
    }

    try {
      const fullKey = this.generateKey(key, options?.prefix);
      const value = await this.redis.get(fullKey);
      
      const duration = Date.now() - startTime;
      
      if (value) {
        this.stats.hits++;
        logger.logCacheOperation('GET', key, true, duration);
        
        let parsedValue = JSON.parse(value);
        
        // Handle compressed values
        if (fullKey.startsWith('compressed:')) {
          const zlib = require('zlib');
          const decompressed = zlib.gunzipSync(Buffer.from(value, 'base64'));
          parsedValue = JSON.parse(decompressed.toString());
        }
        
        this.updateHitRate();
        return parsedValue;
      } else {
        this.stats.misses++;
        logger.logCacheOperation('GET', key, false, duration);
        this.updateHitRate();
        return null;
      }
    } catch (error) {
      this.stats.errors++;
      this.stats.misses++;
      const duration = Date.now() - startTime;
      logger.logError('Cache get error', error as Error, { key, duration });
      this.updateHitRate();
      return null;
    }
  }

  async set<T>(key: string, value: T, options?: CacheOptions): Promise<boolean> {
    const startTime = Date.now();
    
    if (!this.redis) return false;

    try {
      const fullKey = this.generateKey(key, options?.prefix);
      const ttl = options?.ttl || this.defaultTTL;
      let serializedValue = JSON.stringify(value);

      // Optional compression for large values
      if (options?.compress && serializedValue.length > 1024) {
        const zlib = require('zlib');
        serializedValue = zlib.gzipSync(serializedValue).toString('base64');
        // Mark key as compressed
        fullKey.replace(key, `compressed:${key}`);
      }
      
      await this.redis.setex(fullKey, ttl, serializedValue);
      
      // Store tags for cache invalidation
      if (options?.tags && options.tags.length > 0) {
        await this.storeTags(fullKey, options.tags);
      }
      
      this.stats.sets++;
      const duration = Date.now() - startTime;
      logger.logCacheOperation('SET', key, true, duration);
      
      return true;
    } catch (error) {
      this.stats.errors++;
      const duration = Date.now() - startTime;
      logger.logError('Cache set error', error as Error, { key, duration });
      return false;
    }
  }

  async del(key: string, options?: CacheOptions): Promise<boolean> {
    if (!this.redis) return false;

    try {
      const fullKey = this.generateKey(key, options?.prefix);
      await this.redis.del(fullKey);
      return true;
    } catch (error) {
      console.error('Cache delete error:', error);
      return false;
    }
  }

  async exists(key: string, options?: CacheOptions): Promise<boolean> {
    if (!this.redis) return false;

    try {
      const fullKey = this.generateKey(key, options?.prefix);
      const result = await this.redis.exists(fullKey);
      return result === 1;
    } catch (error) {
      console.error('Cache exists error:', error);
      return false;
    }
  }

  async invalidatePattern(pattern: string): Promise<boolean> {
    if (!this.redis) return false;

    try {
      const keys = await this.redis.keys(`${this.keyPrefix}${pattern}`);
      if (keys.length > 0) {
        await this.redis.del(...keys);
      }
      return true;
    } catch (error) {
      console.error('Cache pattern invalidation error:', error);
      return false;
    }
  }

  // Specialized cache methods for common operations
  async cacheStores(): Promise<any[] | null> {
    return this.get('stores', { prefix: 'data', ttl: 1800 }); // 30 minutes
  }

  async setCacheStores(stores: any[]): Promise<boolean> {
    return this.set('stores', stores, { prefix: 'data', ttl: 1800 });
  }

  async cacheBusinessTypes(): Promise<any[] | null> {
    return this.get('business_types', { prefix: 'data', ttl: 3600 }); // 1 hour
  }

  async setCacheBusinessTypes(businessTypes: any[]): Promise<boolean> {
    return this.set('business_types', businessTypes, { prefix: 'data', ttl: 3600 });
  }

  async cacheSalesData(storeId: string, year: number, month: number): Promise<any | null> {
    const key = `sales:${storeId}:${year}:${month}`;
    return this.get(key, { prefix: 'data', ttl: 900 }); // 15 minutes
  }

  async setCacheSalesData(storeId: string, year: number, month: number, data: any): Promise<boolean> {
    const key = `sales:${storeId}:${year}:${month}`;
    return this.set(key, data, { prefix: 'data', ttl: 900 });
  }

  async invalidateSalesCache(storeId?: string): Promise<boolean> {
    const pattern = storeId ? `data:sales:${storeId}:*` : 'data:sales:*';
    return this.invalidatePattern(pattern);
  }

  async invalidateStoreRelatedCache(storeId: string): Promise<boolean> {
    const patterns = [
      `data:sales:${storeId}:*`,
      `data:payments:${storeId}:*`,
      `data:companies:${storeId}:*`,
      'data:stores'
    ];

    for (const pattern of patterns) {
      await this.invalidatePattern(pattern);
    }
    return true;
  }

  // Health check
  async isHealthy(): Promise<boolean> {
    if (!this.redis) return false;

    try {
      await this.redis.ping();
      return true;
    } catch (error) {
      return false;
    }
  }

  async getStats(): Promise<any> {
    if (!this.redis) return null;

    try {
      const info = await this.redis.info('memory');
      return {
        connected: true,
        memory: info,
        keyspace: await this.redis.info('keyspace')
      };
    } catch (error) {
      return { connected: false, error: error.message };
    }
  }

  // Store tags for advanced cache invalidation
  private async storeTags(key: string, tags: string[]): Promise<void> {
    if (!this.redis) return;

    try {
      const pipeline = this.redis.pipeline();
      
      for (const tag of tags) {
        const tagKey = `tag:${tag}`;
        pipeline.sadd(tagKey, key);
        pipeline.expire(tagKey, this.defaultTTL * 2); // Tags expire later than data
      }
      
      await pipeline.exec();
    } catch (error) {
      logger.logError('Failed to store cache tags', error as Error, { key, tags });
    }
  }

  // Advanced cache methods
  async getOrSet<T>(
    key: string,
    fetcher: () => Promise<T>,
    options: CacheOptions = {}
  ): Promise<T> {
    const cached = await this.get<T>(key, options);
    
    if (cached !== null) {
      return cached;
    }

    const fresh = await fetcher();
    await this.set(key, fresh, options);
    return fresh;
  }

  async invalidateByTags(tags: string[]): Promise<boolean> {
    if (!this.redis || tags.length === 0) {
      return false;
    }

    try {
      const allKeys = new Set<string>();

      for (const tag of tags) {
        const tagKey = `tag:${tag}`;
        const keys = await this.redis.smembers(tagKey);
        keys.forEach(key => allKeys.add(key));
        await this.redis.del(tagKey);
      }

      if (allKeys.size > 0) {
        const keysArray = Array.from(allKeys);
        const batchSize = 100;
        
        for (let i = 0; i < keysArray.length; i += batchSize) {
          const batch = keysArray.slice(i, i + batchSize);
          await this.redis.del(...batch);
        }
        
        this.stats.deletes += keysArray.length;
      }

      return true;
    } catch (error) {
      this.stats.errors++;
      logger.logError('Redis tag invalidation failed', error as Error, { tags });
      return false;
    }
  }

  async increment(key: string, value: number = 1): Promise<number> {
    if (!this.redis) {
      throw new Error('Redis not connected');
    }

    try {
      const fullKey = this.generateKey(key);
      const result = await this.redis.incrby(fullKey, value);
      return result;
    } catch (error) {
      this.stats.errors++;
      logger.logError('Redis INCREMENT operation failed', error as Error, { key, value });
      throw error;
    }
  }

  async mget<T>(keys: string[], options?: CacheOptions): Promise<(T | null)[]> {
    if (!this.redis || keys.length === 0) {
      return [];
    }

    try {
      const fullKeys = keys.map(key => this.generateKey(key, options?.prefix));
      const values = await this.redis.mget(...fullKeys);
      
      return values.map((value, index) => {
        if (value) {
          this.stats.hits++;
          try {
            return JSON.parse(value);
          } catch {
            return null;
          }
        } else {
          this.stats.misses++;
          return null;
        }
      });
    } catch (error) {
      this.stats.errors++;
      logger.logError('Redis MGET operation failed', error as Error, { keys });
      return keys.map(() => null);
    }
  }

  async mset<T>(keyValuePairs: Array<{ key: string; value: T }>, options?: CacheOptions): Promise<boolean> {
    if (!this.redis || keyValuePairs.length === 0) {
      return false;
    }

    try {
      const pipeline = this.redis.pipeline();
      const ttl = options?.ttl || this.defaultTTL;

      for (const { key, value } of keyValuePairs) {
        const fullKey = this.generateKey(key, options?.prefix);
        pipeline.setex(fullKey, ttl, JSON.stringify(value));
      }

      await pipeline.exec();
      this.stats.sets += keyValuePairs.length;
      return true;
    } catch (error) {
      this.stats.errors++;
      logger.logError('Redis MSET operation failed', error as Error, { count: keyValuePairs.length });
      return false;
    }
  }

  // Get cache statistics including hit rate
  getCacheStats(): CacheStats {
    this.updateHitRate();
    return { ...this.stats };
  }

  resetStats(): void {
    this.stats = {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0,
      errors: 0,
      hitRate: 0
    };
  }

  async close(): Promise<void> {
    if (this.redis) {
      await this.redis.quit();
      this.redis = null;
    }
  }
}

export const cacheService = new CacheService();
export default cacheService;