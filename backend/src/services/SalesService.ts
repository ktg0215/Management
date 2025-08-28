import { Pool } from 'pg';
import { Response } from 'express';
import { BaseService } from './BaseService';
import { ValidationError, NotFoundError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';

interface SalesData {
  id?: string;
  storeId: string;
  year: number;
  month: number;
  dailyData: Record<string, any>;
  createdBy?: string;
  updatedBy?: string;
}

interface BatchUpsertResult {
  processed: number;
  created: number;
  updated: number;
  failed: number;
  results: Array<{
    id?: string;
    status: 'created' | 'updated' | 'failed';
    error?: string;
  }>;
}

interface PaginationOptions {
  limit: number;
  offset: number;
}

interface ExportOptions {
  format: string;
  year?: number;
  month?: number;
}

export class SalesService extends BaseService {
  constructor(pool: Pool) {
    super(pool, 'sales_data', 'sales');
  }

  async getSalesData(year: number, month: number, storeId: string): Promise<SalesData | null> {
    this.validateDateInputs(year, month);
    
    const cacheKey = `data:${storeId}:${year}:${month}`;
    const cached = await this.getFromCache<SalesData>(cacheKey);
    if (cached) return cached;

    const query = `
      SELECT sd.*, s.name as store_name
      FROM sales_data sd
      JOIN stores s ON sd.store_id = s.id
      WHERE sd.year = $1 AND sd.month = $2 AND sd.store_id = $3
      LIMIT 1
    `;

    const rows = await this.executeQuery<SalesData>(query, [year, month, storeId], 'SELECT');
    const result = rows.length > 0 ? rows[0] : null;
    
    if (result) {
      await this.setCache(cacheKey, result, 900); // 15 minutes cache
    }
    
    return result;
  }

  async createOrUpdateSalesData(salesData: SalesData): Promise<SalesData> {
    this.validateSalesData(salesData);

    const existing = await this.getSalesData(salesData.year, salesData.month, salesData.storeId);
    
    if (existing) {
      return this.updateSalesData(existing.id!, salesData);
    } else {
      return this.createSalesData(salesData);
    }
  }

  private async createSalesData(salesData: SalesData): Promise<SalesData> {
    const query = `
      INSERT INTO sales_data (store_id, year, month, daily_data, created_by, updated_by, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
      RETURNING *
    `;

    const values = [
      salesData.storeId,
      salesData.year,
      salesData.month,
      JSON.stringify(salesData.dailyData),
      salesData.createdBy,
      salesData.updatedBy || salesData.createdBy
    ];

    const rows = await this.executeQuery<SalesData>(query, values, 'INSERT');
    
    if (rows.length > 0) {
      await this.invalidateRelatedCache(salesData.storeId, salesData.year, salesData.month);
      return rows[0];
    }
    
    throw new Error('Failed to create sales data');
  }

  private async updateSalesData(id: string, salesData: SalesData): Promise<SalesData> {
    const query = `
      UPDATE sales_data 
      SET daily_data = $1, updated_by = $2, updated_at = NOW()
      WHERE id = $3
      RETURNING *
    `;

    const values = [
      JSON.stringify(salesData.dailyData),
      salesData.updatedBy,
      id
    ];

    const rows = await this.executeQuery<SalesData>(query, values, 'UPDATE');
    
    if (rows.length > 0) {
      await this.invalidateRelatedCache(salesData.storeId, salesData.year, salesData.month);
      return rows[0];
    }
    
    throw new NotFoundError('Sales data');
  }

  async getSalesDataByStore(storeId: string, limit: number = 12): Promise<SalesData[]> {
    const cacheKey = `store:${storeId}:recent:${limit}`;
    const cached = await this.getFromCache<SalesData[]>(cacheKey);
    if (cached) return cached;

    const query = `
      SELECT * FROM sales_data
      WHERE store_id = $1
      ORDER BY year DESC, month DESC
      LIMIT $2
    `;

    const rows = await this.executeQuery<SalesData>(query, [storeId, limit], 'SELECT');
    await this.setCache(cacheKey, rows, 600); // 10 minutes cache
    
    return rows;
  }

  async getMonthlySalesAggregation(year: number, month: number): Promise<any[]> {
    this.validateDateInputs(year, month);
    
    const cacheKey = `aggregation:${year}:${month}`;
    const cached = await this.getFromCache<any[]>(cacheKey);
    if (cached) return cached;

    const query = `
      SELECT 
        s.id as store_id,
        s.name as store_name,
        bt.name as business_type_name,
        sd.daily_data,
        sd.year,
        sd.month,
        sd.updated_at
      FROM sales_data sd
      JOIN stores s ON sd.store_id = s.id
      JOIN business_types bt ON s.business_type_id = bt.id
      WHERE sd.year = $1 AND sd.month = $2
      ORDER BY s.name
    `;

    const rows = await this.executeQuery(query, [year, month], 'SELECT');
    await this.setCache(cacheKey, rows, 1800); // 30 minutes cache
    
    return rows;
  }

  async deleteSalesData(id: string): Promise<boolean> {
    // First get the record to know what cache to invalidate
    const salesData = await this.findById(id);
    if (!salesData) {
      throw new NotFoundError('Sales data');
    }

    const success = await this.delete(id);
    
    if (success) {
      await this.invalidateRelatedCache(salesData.store_id, salesData.year, salesData.month);
    }
    
    return success;
  }

  private validateDateInputs(year: number, month: number): void {
    if (!year || year < 2020 || year > 2030) {
      throw new ValidationError('Year must be between 2020 and 2030');
    }
    
    if (!month || month < 1 || month > 12) {
      throw new ValidationError('Month must be between 1 and 12');
    }
  }

  private validateSalesData(salesData: SalesData): void {
    if (!salesData.storeId) {
      throw new ValidationError('Store ID is required');
    }
    
    this.validateDateInputs(salesData.year, salesData.month);
    
    if (!salesData.dailyData || typeof salesData.dailyData !== 'object') {
      throw new ValidationError('Daily data must be a valid object');
    }
    
    if (!salesData.createdBy && !salesData.updatedBy) {
      throw new ValidationError('User ID is required for audit trail');
    }
  }

  private async invalidateRelatedCache(storeId: string, year: number, month: number): Promise<void> {
    await this.invalidateCache(`data:${storeId}:${year}:${month}`);
    await this.invalidateCache(`store:${storeId}:*`);
    await this.invalidateCache(`aggregation:${year}:${month}`);
  }

  // Analytics methods
  async getSalesAnalytics(storeId: string, startYear: number, endYear: number): Promise<any> {
    const cacheKey = `analytics:${storeId}:${startYear}:${endYear}`;
    const cached = await this.getFromCache(cacheKey);
    if (cached) return cached;

    const query = `
      SELECT 
        year,
        month,
        daily_data,
        EXTRACT(epoch FROM updated_at) as last_updated
      FROM sales_data
      WHERE store_id = $1 
        AND year BETWEEN $2 AND $3
      ORDER BY year, month
    `;

    const rows = await this.executeQuery(query, [storeId, startYear, endYear], 'SELECT');
    
    // Process analytics data here
    const analytics = this.processAnalyticsData(rows);
    
    await this.setCache(cacheKey, analytics, 3600); // 1 hour cache
    return analytics;
  }

  private processAnalyticsData(data: any[]): any {
    // Implement your analytics processing logic here
    return {
      totalRecords: data.length,
      yearlyData: data.reduce((acc, record) => {
        const year = record.year;
        if (!acc[year]) acc[year] = [];
        acc[year].push(record);
        return acc;
      }, {}),
      lastUpdated: new Date().toISOString()
    };
  }

  // Batch upsert operations for bulk data processing
  async batchUpsertSalesData(salesDataArray: SalesData[], userId: string): Promise<BatchUpsertResult> {
    if (!Array.isArray(salesDataArray) || salesDataArray.length === 0) {
      throw new ValidationError('Sales data array cannot be empty');
    }

    const result: BatchUpsertResult = {
      processed: 0,
      created: 0,
      updated: 0,
      failed: 0,
      results: []
    };

    const batchSize = 50; // Process in batches to avoid overwhelming the database
    
    for (let i = 0; i < salesDataArray.length; i += batchSize) {
      const batch = salesDataArray.slice(i, i + batchSize);
      
      await this.processSalesDataBatch(batch, userId, result);
    }

    // Invalidate related cache
    await this.invalidateCache('*');

    logger.logInfo('Batch sales data operation completed', {
      processed: result.processed,
      created: result.created,
      updated: result.updated,
      failed: result.failed
    });

    return result;
  }

  private async processSalesDataBatch(
    batch: SalesData[], 
    userId: string, 
    result: BatchUpsertResult
  ): Promise<void> {
    const client = await this.pool.connect();
    
    try {
      await client.query('BEGIN');

      for (const salesData of batch) {
        try {
          this.validateSalesData({
            ...salesData,
            createdBy: userId,
            updatedBy: userId
          });

          // Check if record exists
          const existingQuery = `
            SELECT id FROM sales_data 
            WHERE year = $1 AND month = $2 AND store_id = $3
          `;
          
          const existingResult = await client.query(existingQuery, [
            salesData.year,
            salesData.month,
            salesData.storeId
          ]);

          if (existingResult.rows.length > 0) {
            // Update existing record
            const updateQuery = `
              UPDATE sales_data 
              SET daily_data = $1, updated_by = $2, updated_at = NOW()
              WHERE id = $3
              RETURNING id
            `;
            
            const updateResult = await client.query(updateQuery, [
              JSON.stringify(salesData.dailyData),
              userId,
              existingResult.rows[0].id
            ]);

            result.results.push({
              id: updateResult.rows[0].id,
              status: 'updated'
            });
            result.updated++;
          } else {
            // Create new record
            const insertQuery = `
              INSERT INTO sales_data (store_id, year, month, daily_data, created_by, updated_by, created_at, updated_at)
              VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
              RETURNING id
            `;
            
            const insertResult = await client.query(insertQuery, [
              salesData.storeId,
              salesData.year,
              salesData.month,
              JSON.stringify(salesData.dailyData),
              userId,
              userId
            ]);

            result.results.push({
              id: insertResult.rows[0].id,
              status: 'created'
            });
            result.created++;
          }

          result.processed++;
        } catch (error) {
          result.results.push({
            status: 'failed',
            error: (error as Error).message
          });
          result.failed++;
          
          logger.logError('Batch sales data item failed', error as Error, {
            salesData,
            userId
          });
        }
      }

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  // Get sales data by date range with pagination
  async getSalesDataByDateRange(
    storeId: string,
    startDate: Date,
    endDate: Date,
    pagination?: PaginationOptions
  ): Promise<{ data: SalesData[]; total: number }> {
    if (!storeId) {
      throw new ValidationError('Store ID is required');
    }

    if (startDate > endDate) {
      throw new ValidationError('Start date must be before end date');
    }

    const cacheKey = `daterange:${storeId}:${startDate.toISOString()}:${endDate.toISOString()}:${pagination?.limit || 'all'}:${pagination?.offset || 0}`;
    const cached = await this.getFromCache<{ data: SalesData[]; total: number }>(cacheKey);
    if (cached) return cached;

    // Count total records
    const countQuery = `
      SELECT COUNT(*) as total
      FROM sales_data sd
      WHERE sd.store_id = $1 
        AND (
          (sd.year = $2 AND sd.month >= $3) OR
          (sd.year > $2 AND sd.year < $4) OR
          (sd.year = $4 AND sd.month <= $5)
        )
    `;

    const startYear = startDate.getFullYear();
    const startMonth = startDate.getMonth() + 1;
    const endYear = endDate.getFullYear();
    const endMonth = endDate.getMonth() + 1;

    const countResult = await this.executeQuery(countQuery, [
      storeId, startYear, startMonth, endYear, endMonth
    ], 'SELECT');

    const total = parseInt(countResult[0].total);

    // Get data with pagination
    let dataQuery = `
      SELECT sd.*, s.name as store_name
      FROM sales_data sd
      JOIN stores s ON sd.store_id = s.id
      WHERE sd.store_id = $1 
        AND (
          (sd.year = $2 AND sd.month >= $3) OR
          (sd.year > $2 AND sd.year < $4) OR
          (sd.year = $4 AND sd.month <= $5)
        )
      ORDER BY sd.year DESC, sd.month DESC
    `;

    const params = [storeId, startYear, startMonth, endYear, endMonth];

    if (pagination) {
      dataQuery += ` LIMIT $6 OFFSET $7`;
      params.push(pagination.limit, pagination.offset);
    }

    const data = await this.executeQuery<SalesData>(dataQuery, params, 'SELECT');

    const result = { data, total };
    await this.setCache(cacheKey, result, 600); // 10 minutes cache

    return result;
  }

  // Stream export for large datasets
  async streamSalesDataExport(
    storeId: string,
    options: ExportOptions,
    res: Response
  ): Promise<void> {
    if (!storeId) {
      throw new ValidationError('Store ID is required');
    }

    let query = `
      SELECT sd.*, s.name as store_name, s.business_type_id
      FROM sales_data sd
      JOIN stores s ON sd.store_id = s.id
      WHERE sd.store_id = $1
    `;

    const params: any[] = [storeId];

    if (options.year) {
      query += ` AND sd.year = $${params.length + 1}`;
      params.push(options.year);
    }

    if (options.month) {
      query += ` AND sd.month = $${params.length + 1}`;
      params.push(options.month);
    }

    query += ` ORDER BY sd.year DESC, sd.month DESC`;

    const client = await this.pool.connect();
    
    try {
      const queryResult = await client.query(query, params);
      
      if (options.format === 'json') {
        res.write('{"data":[');
        
        for (let i = 0; i < queryResult.rows.length; i++) {
          if (i > 0) res.write(',');
          res.write(JSON.stringify(queryResult.rows[i]));
        }
        
        res.write(']}');
      } else if (options.format === 'csv') {
        // Write CSV header
        const headers = Object.keys(queryResult.rows[0] || {});
        res.write(headers.join(',') + '\n');
        
        // Write data rows
        for (const row of queryResult.rows) {
          const values = headers.map(header => {
            const value = row[header];
            if (typeof value === 'object' && value !== null) {
              return `"${JSON.stringify(value).replace(/"/g, '""')}"`;
            }
            return `"${String(value || '').replace(/"/g, '""')}"`;
          });
          res.write(values.join(',') + '\n');
        }
      }
      
      res.end();
    } catch (error) {
      logger.logError('Sales data export streaming failed', error as Error, {
        storeId,
        options
      });
      throw error;
    } finally {
      client.release();
    }
  }

  // Bulk delete operations
  async bulkDeleteSalesData(ids: string[], userId: string): Promise<number> {
    if (!Array.isArray(ids) || ids.length === 0) {
      throw new ValidationError('IDs array cannot be empty');
    }

    const client = await this.pool.connect();
    let deletedCount = 0;

    try {
      await client.query('BEGIN');

      // Delete in batches to avoid parameter limits
      const batchSize = 100;
      for (let i = 0; i < ids.length; i += batchSize) {
        const batch = ids.slice(i, i + batchSize);
        const placeholders = batch.map((_, index) => `$${index + 1}`).join(',');
        
        const deleteQuery = `
          DELETE FROM sales_data 
          WHERE id IN (${placeholders})
          AND store_id IN (
            SELECT store_id FROM employee_stores WHERE employee_id = $${batch.length + 1}
          )
        `;
        
        const result = await client.query(deleteQuery, [...batch, userId]);
        deletedCount += result.rowCount || 0;
      }

      await client.query('COMMIT');
      
      // Invalidate cache
      await this.invalidateCache('*');
      
      logger.logInfo('Bulk sales data deletion completed', {
        requestedCount: ids.length,
        deletedCount,
        userId
      });

      return deletedCount;
    } catch (error) {
      await client.query('ROLLBACK');
      logger.logError('Bulk sales data deletion failed', error as Error, {
        idsCount: ids.length,
        userId
      });
      throw error;
    } finally {
      client.release();
    }
  }
}