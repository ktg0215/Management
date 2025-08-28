import { Pool } from 'pg';
import { logger } from '../utils/logger';
import { cacheService } from '../cache/redisCache';
import { AppError, DatabaseError } from '../middleware/errorHandler';

export abstract class BaseService {
  protected pool: Pool;
  protected tableName: string;
  protected cachePrefix: string;

  constructor(pool: Pool, tableName: string, cachePrefix: string) {
    this.pool = pool;
    this.tableName = tableName;
    this.cachePrefix = cachePrefix;
  }

  protected async executeQuery<T>(
    query: string, 
    params: any[] = [], 
    operation: string = 'query'
  ): Promise<T[]> {
    const startTime = Date.now();
    
    try {
      const result = await this.pool.query(query, params);
      const duration = Date.now() - startTime;
      
      logger.logDatabaseOperation(operation, this.tableName, duration, true);
      
      if (duration > 1000) {
        logger.logPerformance(`Database ${operation}`, duration, {
          table: this.tableName,
          query: query.substring(0, 100) + '...'
        });
      }
      
      return result.rows;
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.logDatabaseOperation(operation, this.tableName, duration, false, error as Error);
      
      throw new DatabaseError(`Failed to execute ${operation} on ${this.tableName}`, error as Error);
    }
  }

  protected async executeTransaction<T>(operations: (() => Promise<T>)[]): Promise<T[]> {
    const client = await this.pool.connect();
    
    try {
      await client.query('BEGIN');
      
      const results: T[] = [];
      for (const operation of operations) {
        results.push(await operation());
      }
      
      await client.query('COMMIT');
      return results;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  protected getCacheKey(key: string): string {
    return `${this.cachePrefix}:${key}`;
  }

  protected async getFromCache<T>(key: string): Promise<T | null> {
    return cacheService.get<T>(this.getCacheKey(key));
  }

  protected async setCache<T>(key: string, data: T, ttl?: number): Promise<boolean> {
    return cacheService.set(this.getCacheKey(key), data, { ttl });
  }

  protected async invalidateCache(pattern: string): Promise<boolean> {
    return cacheService.invalidatePattern(`${this.cachePrefix}:${pattern}`);
  }

  // Common CRUD operations
  async findById(id: string): Promise<any | null> {
    const cacheKey = `id:${id}`;
    const cached = await this.getFromCache(cacheKey);
    if (cached) return cached;

    const query = `SELECT * FROM ${this.tableName} WHERE id = $1 LIMIT 1`;
    const rows = await this.executeQuery(query, [id], 'SELECT');
    
    const result = rows.length > 0 ? rows[0] : null;
    if (result) {
      await this.setCache(cacheKey, result, 300); // 5 minutes cache
    }
    
    return result;
  }

  async create(data: Record<string, any>): Promise<any> {
    const fields = Object.keys(data).join(', ');
    const placeholders = Object.keys(data).map((_, index) => `$${index + 1}`).join(', ');
    const values = Object.values(data);

    const query = `
      INSERT INTO ${this.tableName} (${fields})
      VALUES (${placeholders})
      RETURNING *
    `;

    const rows = await this.executeQuery(query, values, 'INSERT');
    
    if (rows.length > 0) {
      await this.invalidateCache('*'); // Invalidate all cache for this entity
      return rows[0];
    }
    
    throw new DatabaseError(`Failed to create record in ${this.tableName}`);
  }

  async update(id: string, data: Record<string, any>): Promise<any> {
    const updates = Object.keys(data)
      .map((key, index) => `${key} = $${index + 2}`)
      .join(', ');
    const values = [id, ...Object.values(data)];

    const query = `
      UPDATE ${this.tableName}
      SET ${updates}, updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `;

    const rows = await this.executeQuery(query, values, 'UPDATE');
    
    if (rows.length > 0) {
      await this.invalidateCache('*');
      return rows[0];
    }
    
    throw new AppError(`Record with ID ${id} not found in ${this.tableName}`, 404);
  }

  async delete(id: string): Promise<boolean> {
    const query = `DELETE FROM ${this.tableName} WHERE id = $1`;
    const rows = await this.executeQuery(query, [id], 'DELETE');
    
    if (rows.length > 0) {
      await this.invalidateCache('*');
      return true;
    }
    
    return false;
  }

  async findAll(limit: number = 100, offset: number = 0): Promise<any[]> {
    const cacheKey = `all:${limit}:${offset}`;
    const cached = await this.getFromCache<any[]>(cacheKey);
    if (cached) return cached;

    const query = `
      SELECT * FROM ${this.tableName}
      ORDER BY created_at DESC
      LIMIT $1 OFFSET $2
    `;

    const rows = await this.executeQuery(query, [limit, offset], 'SELECT');
    await this.setCache(cacheKey, rows, 180); // 3 minutes cache
    
    return rows;
  }
}