import { Pool, PoolConfig, PoolClient } from 'pg';
import { logger } from '../utils/logger';

interface QueryMetrics {
  query: string;
  duration: number;
  rows: number;
  timestamp: Date;
  cached?: boolean;
}

interface PoolStats {
  totalConnections: number;
  idleConnections: number;
  waitingClients: number;
  totalQueries: number;
  averageQueryTime: number;
  slowQueries: number;
  cacheHits: number;
  cacheMisses: number;
}

class OptimizedDatabasePool {
  private pool: Pool;
  private queryMetrics: Map<string, QueryMetrics[]> = new Map();
  private stats: PoolStats;
  private queryCache: Map<string, { result: any; expires: number }> = new Map();
  private readonly CACHE_TTL = 300000; // 5 minutes
  private readonly SLOW_QUERY_THRESHOLD = 1000; // 1 second

  constructor() {
    this.stats = {
      totalConnections: 0,
      idleConnections: 0,
      waitingClients: 0,
      totalQueries: 0,
      averageQueryTime: 0,
      slowQueries: 0,
      cacheHits: 0,
      cacheMisses: 0
    };

    this.initializePool();
    this.startMetricsCollection();
  }

  private initializePool(): void {
    const poolConfig: PoolConfig = {
      // Connection parameters
      connectionString: process.env.DATABASE_URL?.trim(),
      
      // Pool sizing - optimized for typical web application
      min: parseInt(process.env.DB_POOL_MIN || '5'),
      max: parseInt(process.env.DB_POOL_MAX || '20'),
      
      // Connection lifecycle
      idleTimeoutMillis: parseInt(process.env.DB_IDLE_TIMEOUT || '30000'), // 30 seconds
      connectionTimeoutMillis: parseInt(process.env.DB_CONNECTION_TIMEOUT || '10000'), // 10 seconds
      acquireTimeoutMillis: parseInt(process.env.DB_ACQUIRE_TIMEOUT || '60000'), // 60 seconds
      
      // Query configuration
      query_timeout: parseInt(process.env.DB_QUERY_TIMEOUT || '30000'), // 30 seconds
      statement_timeout: parseInt(process.env.DB_STATEMENT_TIMEOUT || '45000'), // 45 seconds
      
      // SSL configuration
      ssl: process.env.NODE_ENV === 'production' ? {
        rejectUnauthorized: false
      } : false,
      
      // Advanced connection options
      application_name: 'sales_management_api',
      
      // Connection validation
      allowExitOnIdle: true,
    };

    this.pool = new Pool(poolConfig);

    // Event listeners for monitoring
    this.pool.on('connect', (client: PoolClient) => {
      this.stats.totalConnections++;
      
      // Set optimal connection parameters
      client.query(`
        SET statement_timeout = '45s';
        SET idle_in_transaction_session_timeout = '30s';
        SET work_mem = '32MB';
        SET maintenance_work_mem = '256MB';
        SET effective_cache_size = '1GB';
        SET random_page_cost = 1.1;
        SET seq_page_cost = 1.0;
        SET default_statistics_target = 100;
      `).catch(error => {
        logger.logError('Failed to set connection parameters', error);
      });

      logger.logInfo('Database connection established', {
        totalConnections: this.stats.totalConnections
      });
    });

    this.pool.on('acquire', () => {
      logger.logDebug('Database connection acquired');
    });

    this.pool.on('remove', () => {
      this.stats.totalConnections--;
      logger.logDebug('Database connection removed', {
        totalConnections: this.stats.totalConnections
      });
    });

    this.pool.on('error', (error: Error) => {
      logger.logError('Database pool error', error);
    });
  }

  // Execute query with performance monitoring and optional caching
  async query<T = any>(
    text: string, 
    params?: any[], 
    options: { cacheable?: boolean; cacheKey?: string } = {}
  ): Promise<{ rows: T[]; rowCount: number }> {
    const startTime = Date.now();
    const cacheKey = options.cacheKey || this.generateCacheKey(text, params);

    // Check cache for cacheable queries
    if (options.cacheable && this.queryCache.has(cacheKey)) {
      const cached = this.queryCache.get(cacheKey)!;
      if (Date.now() < cached.expires) {
        this.stats.cacheHits++;
        logger.logCacheOperation('QUERY_CACHE', cacheKey, true, Date.now() - startTime);
        return cached.result;
      } else {
        this.queryCache.delete(cacheKey);
      }
    }

    try {
      const result = await this.pool.query(text, params);
      const duration = Date.now() - startTime;

      // Update statistics
      this.stats.totalQueries++;
      this.stats.averageQueryTime = (
        (this.stats.averageQueryTime * (this.stats.totalQueries - 1) + duration) / 
        this.stats.totalQueries
      );

      if (duration > this.SLOW_QUERY_THRESHOLD) {
        this.stats.slowQueries++;
        logger.logWarning('Slow query detected', {
          query: text.substring(0, 200) + '...',
          duration,
          rowCount: result.rowCount,
          params: params ? params.length : 0
        });
      }

      // Log query metrics
      this.recordQueryMetrics(text, duration, result.rowCount || 0);

      // Cache result if cacheable
      if (options.cacheable) {
        this.queryCache.set(cacheKey, {
          result,
          expires: Date.now() + this.CACHE_TTL
        });
        this.stats.cacheMisses++;
      }

      logger.logDatabaseOperation('QUERY', 'multiple', duration, true);

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.logDatabaseOperation('QUERY', 'multiple', duration, false, error as Error);
      
      // Log detailed error information
      logger.logError('Database query failed', error as Error, {
        query: text.substring(0, 200) + '...',
        params: params ? params.length : 0,
        duration
      });

      throw error;
    }
  }

  // Execute transaction with retry logic
  async transaction<T>(
    operations: (client: PoolClient) => Promise<T>,
    options: { retries?: number; isolation?: string } = {}
  ): Promise<T> {
    const maxRetries = options.retries || 3;
    const isolation = options.isolation || 'READ COMMITTED';
    
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      const client = await this.pool.connect();
      
      try {
        await client.query('BEGIN');
        
        if (isolation !== 'READ COMMITTED') {
          await client.query(`SET TRANSACTION ISOLATION LEVEL ${isolation}`);
        }

        const result = await operations(client);
        await client.query('COMMIT');
        
        logger.logInfo('Transaction completed successfully', {
          attempt: attempt + 1,
          isolation
        });

        return result;
      } catch (error) {
        await client.query('ROLLBACK').catch(() => {});
        lastError = error as Error;

        if (attempt < maxRetries - 1 && this.isRetryableError(error as Error)) {
          logger.logWarning(`Transaction failed, retrying (${attempt + 1}/${maxRetries})`, {
            error: (error as Error).message
          });
          await this.delay(Math.pow(2, attempt) * 100); // Exponential backoff
        } else {
          logger.logError('Transaction failed permanently', error as Error, {
            attempts: attempt + 1,
            maxRetries
          });
          break;
        }
      } finally {
        client.release();
      }
    }

    throw lastError;
  }

  // Batch query execution with connection reuse
  async batch<T>(
    queries: Array<{ text: string; params?: any[] }>,
    options: { useTransaction?: boolean; continueOnError?: boolean } = {}
  ): Promise<Array<{ rows: T[]; rowCount: number } | Error>> {
    const results: Array<{ rows: T[]; rowCount: number } | Error> = [];
    
    if (options.useTransaction) {
      return this.transaction(async (client) => {
        for (const query of queries) {
          try {
            const result = await client.query(query.text, query.params);
            results.push(result);
          } catch (error) {
            if (!options.continueOnError) {
              throw error;
            }
            results.push(error as Error);
          }
        }
        return results;
      });
    } else {
      const client = await this.pool.connect();
      
      try {
        for (const query of queries) {
          try {
            const result = await client.query(query.text, query.params);
            results.push(result);
          } catch (error) {
            if (!options.continueOnError) {
              throw error;
            }
            results.push(error as Error);
          }
        }
      } finally {
        client.release();
      }

      return results;
    }
  }

  // Prepared statement management
  private preparedStatements: Map<string, boolean> = new Map();

  async executePrepared<T = any>(
    name: string,
    text: string,
    params: any[]
  ): Promise<{ rows: T[]; rowCount: number }> {
    const client = await this.pool.connect();
    
    try {
      // Prepare statement if not already prepared
      if (!this.preparedStatements.has(name)) {
        await client.query({
          name,
          text
        });
        this.preparedStatements.set(name, true);
      }

      // Execute prepared statement
      const result = await client.query({
        name,
        values: params
      });

      return result;
    } finally {
      client.release();
    }
  }

  // Stream large result sets
  async streamQuery(
    text: string,
    params: any[],
    callback: (row: any) => Promise<void> | void,
    options: { batchSize?: number } = {}
  ): Promise<void> {
    const batchSize = options.batchSize || 1000;
    let offset = 0;
    let hasMore = true;

    while (hasMore) {
      const paginatedQuery = `${text} LIMIT ${batchSize} OFFSET ${offset}`;
      const result = await this.query(paginatedQuery, params);
      
      if (result.rows.length === 0) {
        hasMore = false;
      } else {
        for (const row of result.rows) {
          await callback(row);
        }
        
        offset += batchSize;
        hasMore = result.rows.length === batchSize;
      }
    }
  }

  // Connection and performance monitoring
  getStats(): PoolStats & { 
    poolInfo: any;
    queryCache: { size: number; hitRate: number };
    topSlowQueries: Array<{ query: string; avgDuration: number; count: number }>;
  } {
    const poolInfo = {
      totalCount: this.pool.totalCount,
      idleCount: this.pool.idleCount,
      waitingCount: this.pool.waitingCount
    };

    // Calculate cache hit rate
    const totalCacheRequests = this.stats.cacheHits + this.stats.cacheMisses;
    const cacheHitRate = totalCacheRequests > 0 
      ? (this.stats.cacheHits / totalCacheRequests) * 100 
      : 0;

    // Get top slow queries
    const topSlowQueries = this.getTopSlowQueries(5);

    return {
      ...this.stats,
      poolInfo,
      queryCache: {
        size: this.queryCache.size,
        hitRate: Math.round(cacheHitRate * 100) / 100
      },
      topSlowQueries
    };
  }

  // Health check
  async healthCheck(): Promise<{ healthy: boolean; details: any }> {
    try {
      const client = await this.pool.connect();
      const start = Date.now();
      
      await client.query('SELECT 1 as health_check');
      const responseTime = Date.now() - start;
      
      client.release();

      return {
        healthy: true,
        details: {
          responseTime,
          connections: {
            total: this.pool.totalCount,
            idle: this.pool.idleCount,
            waiting: this.pool.waitingCount
          },
          timestamp: new Date().toISOString()
        }
      };
    } catch (error) {
      return {
        healthy: false,
        details: {
          error: (error as Error).message,
          timestamp: new Date().toISOString()
        }
      };
    }
  }

  // Cache management
  clearQueryCache(): void {
    this.queryCache.clear();
    logger.logInfo('Query cache cleared');
  }

  // Graceful shutdown
  async close(): Promise<void> {
    await this.pool.end();
    this.queryCache.clear();
    logger.logInfo('Database pool closed');
  }

  // Private helper methods
  private recordQueryMetrics(query: string, duration: number, rows: number): void {
    const queryKey = this.normalizeQuery(query);
    
    if (!this.queryMetrics.has(queryKey)) {
      this.queryMetrics.set(queryKey, []);
    }

    const metrics = this.queryMetrics.get(queryKey)!;
    metrics.push({
      query: queryKey,
      duration,
      rows,
      timestamp: new Date()
    });

    // Keep only recent metrics (last 1000 queries per query type)
    if (metrics.length > 1000) {
      metrics.splice(0, metrics.length - 1000);
    }
  }

  private normalizeQuery(query: string): string {
    // Remove parameters and normalize whitespace for grouping similar queries
    return query
      .replace(/\$\d+/g, '?')
      .replace(/\s+/g, ' ')
      .trim()
      .substring(0, 200);
  }

  private generateCacheKey(query: string, params?: any[]): string {
    const paramString = params ? JSON.stringify(params) : '';
    const hash = require('crypto').createHash('md5');
    hash.update(query + paramString);
    return hash.digest('hex');
  }

  private getTopSlowQueries(limit: number): Array<{ query: string; avgDuration: number; count: number }> {
    const queryStats = new Map<string, { totalDuration: number; count: number }>();

    for (const [query, metrics] of this.queryMetrics.entries()) {
      const totalDuration = metrics.reduce((sum, metric) => sum + metric.duration, 0);
      const count = metrics.length;
      queryStats.set(query, { totalDuration, count });
    }

    return Array.from(queryStats.entries())
      .map(([query, stats]) => ({
        query,
        avgDuration: Math.round(stats.totalDuration / stats.count),
        count: stats.count
      }))
      .sort((a, b) => b.avgDuration - a.avgDuration)
      .slice(0, limit);
  }

  private startMetricsCollection(): void {
    // Update pool statistics every 30 seconds
    setInterval(() => {
      this.stats.totalConnections = this.pool.totalCount;
      this.stats.idleConnections = this.pool.idleCount;
      this.stats.waitingClients = this.pool.waitingCount;

      // Cleanup expired cache entries
      this.cleanupExpiredCache();
    }, 30000);
  }

  private cleanupExpiredCache(): void {
    const now = Date.now();
    let cleaned = 0;

    for (const [key, cached] of this.queryCache.entries()) {
      if (now >= cached.expires) {
        this.queryCache.delete(key);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      logger.logDebug(`Cleaned ${cleaned} expired cache entries`);
    }
  }

  private isRetryableError(error: Error): boolean {
    const retryableErrors = [
      'ECONNRESET',
      'ENOTFOUND',
      'ECONNREFUSED',
      'ETIMEDOUT',
      '40001', // serialization_failure
      '40P01', // deadlock_detected
      '08006', // connection_failure
      '08003', // connection_does_not_exist
      '08000', // connection_exception
    ];

    return retryableErrors.some(code => 
      error.message.includes(code) || 
      (error as any).code === code
    );
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export const optimizedPool = new OptimizedDatabasePool();
export default optimizedPool;