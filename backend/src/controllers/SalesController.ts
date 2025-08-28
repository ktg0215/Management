import { Request, Response } from 'express';
import { SalesService } from '../services/SalesService';
import { Pool } from 'pg';
import { logger } from '../utils/logger';
import { ValidationError, NotFoundError } from '../middleware/errorHandler';
import { projectResponse } from '../middleware/responseOptimization';

export class SalesController {
  private salesService: SalesService;

  constructor(pool: Pool) {
    this.salesService = new SalesService(pool);
  }

  // Getter to access the service for advanced operations
  getSalesService(): SalesService {
    return this.salesService;
  }

  // Get sales data with field projection and caching
  async getSalesData(req: Request, res: Response) {
    try {
      const { year, month, storeId } = req.query;
      
      if (!year || !month || !storeId) {
        throw new ValidationError('year, month, and storeId are required');
      }

      const salesData = await this.salesService.getSalesData(
        parseInt(year as string),
        parseInt(month as string),
        storeId as string
      );

      const projection = (req as any).projection;
      const projectedData = projection ? projectResponse(salesData, projection) : salesData;

      res.json({
        success: true,
        data: projectedData
      });
    } catch (error) {
      logger.logError('Sales data retrieval failed', error as Error, {
        query: req.query,
        path: req.path
      });
      
      if (error instanceof ValidationError) {
        res.status(400).json({ success: false, error: error.message });
      } else {
        res.status(500).json({ success: false, error: 'Failed to retrieve sales data' });
      }
    }
  }

  // Get aggregated sales data with optimized queries
  async getAggregatedSalesData(req: Request, res: Response) {
    try {
      const { year, month, businessType } = req.query;
      const pagination = (req as any).pagination;

      if (!year || !month) {
        throw new ValidationError('year and month are required');
      }

      // Build optimized aggregation query
      const aggregatedData = await this.salesService.getMonthlySalesAggregation(
        parseInt(year as string),
        parseInt(month as string)
      );

      // Apply business type filter if specified
      let filteredData = aggregatedData;
      if (businessType) {
        filteredData = aggregatedData.filter(item => 
          item.business_type_name === businessType
        );
      }

      // Apply pagination if configured
      if (pagination) {
        const startIndex = pagination.offset;
        const endIndex = startIndex + pagination.limit;
        const paginatedData = filteredData.slice(startIndex, endIndex);
        
        res.json({
          success: true,
          data: paginatedData,
          total: filteredData.length
        });
      } else {
        res.json({
          success: true,
          data: filteredData
        });
      }
    } catch (error) {
      logger.logError('Aggregated sales data retrieval failed', error as Error, {
        query: req.query,
        path: req.path
      });
      
      res.status(500).json({ 
        success: false, 
        error: 'Failed to retrieve aggregated sales data' 
      });
    }
  }

  // Batch create/update sales data
  async batchUpsertSalesData(req: Request, res: Response) {
    try {
      const { salesDataArray } = req.body;
      
      if (!Array.isArray(salesDataArray)) {
        throw new ValidationError('salesDataArray must be an array');
      }

      const results = await this.salesService.batchUpsertSalesData(
        salesDataArray,
        (req as any).user?.id
      );

      res.json({
        success: true,
        data: {
          processed: results.processed,
          created: results.created,
          updated: results.updated,
          failed: results.failed,
          results: results.results
        }
      });
    } catch (error) {
      logger.logError('Batch sales data upsert failed', error as Error, {
        body: req.body,
        path: req.path
      });
      
      if (error instanceof ValidationError) {
        res.status(400).json({ success: false, error: error.message });
      } else {
        res.status(500).json({ success: false, error: 'Failed to process batch sales data' });
      }
    }
  }

  // Get sales analytics with caching
  async getSalesAnalytics(req: Request, res: Response) {
    try {
      const { storeId, startYear, endYear, metrics } = req.query;
      
      if (!storeId) {
        throw new ValidationError('storeId is required');
      }

      const defaultStartYear = new Date().getFullYear() - 1;
      const defaultEndYear = new Date().getFullYear();

      const analytics = await this.salesService.getSalesAnalytics(
        storeId as string,
        parseInt(startYear as string) || defaultStartYear,
        parseInt(endYear as string) || defaultEndYear
      );

      // Filter metrics if specified
      let responseData = analytics;
      if (metrics) {
        const requestedMetrics = (metrics as string).split(',').map(m => m.trim());
        responseData = {
          ...analytics,
          metrics: Object.keys(analytics.metrics || {})
            .filter(key => requestedMetrics.includes(key))
            .reduce((obj, key) => {
              obj[key] = analytics.metrics[key];
              return obj;
            }, {} as any)
        };
      }

      res.json({
        success: true,
        data: responseData
      });
    } catch (error) {
      logger.logError('Sales analytics retrieval failed', error as Error, {
        query: req.query,
        path: req.path
      });
      
      if (error instanceof ValidationError) {
        res.status(400).json({ success: false, error: error.message });
      } else {
        res.status(500).json({ success: false, error: 'Failed to retrieve sales analytics' });
      }
    }
  }

  // Get sales data by date range with optimization
  async getSalesDataByDateRange(req: Request, res: Response) {
    try {
      const { storeId, startDate, endDate } = req.query;
      const pagination = (req as any).pagination;
      
      if (!storeId || !startDate || !endDate) {
        throw new ValidationError('storeId, startDate, and endDate are required');
      }

      const salesData = await this.salesService.getSalesDataByDateRange(
        storeId as string,
        new Date(startDate as string),
        new Date(endDate as string),
        pagination
      );

      res.json({
        success: true,
        data: salesData.data,
        total: salesData.total
      });
    } catch (error) {
      logger.logError('Sales data by date range retrieval failed', error as Error, {
        query: req.query,
        path: req.path
      });
      
      if (error instanceof ValidationError) {
        res.status(400).json({ success: false, error: error.message });
      } else {
        res.status(500).json({ success: false, error: 'Failed to retrieve sales data by date range' });
      }
    }
  }

  // Export sales data with streaming for large datasets
  async exportSalesData(req: Request, res: Response) {
    try {
      const { storeId, format = 'json', year, month } = req.query;
      
      if (!storeId) {
        throw new ValidationError('storeId is required');
      }

      // Set appropriate headers for download
      res.setHeader('Content-Disposition', 
        `attachment; filename="sales-data-${storeId}-${year || 'all'}-${month || 'all'}.${format}"`);
      
      if (format === 'json') {
        res.setHeader('Content-Type', 'application/json');
      } else if (format === 'csv') {
        res.setHeader('Content-Type', 'text/csv');
      }

      // Stream data to avoid memory issues with large datasets
      await this.salesService.streamSalesDataExport(
        storeId as string,
        {
          format: format as string,
          year: year ? parseInt(year as string) : undefined,
          month: month ? parseInt(month as string) : undefined
        },
        res
      );
    } catch (error) {
      logger.logError('Sales data export failed', error as Error, {
        query: req.query,
        path: req.path
      });
      
      if (!res.headersSent) {
        if (error instanceof ValidationError) {
          res.status(400).json({ success: false, error: error.message });
        } else {
          res.status(500).json({ success: false, error: 'Failed to export sales data' });
        }
      }
    }
  }

  // Delete sales data with cascade handling
  async deleteSalesData(req: Request, res: Response) {
    try {
      const { id } = req.params;
      
      if (!id) {
        throw new ValidationError('Sales data ID is required');
      }

      const deleted = await this.salesService.deleteSalesData(id);
      
      if (!deleted) {
        throw new NotFoundError('Sales data');
      }

      res.json({
        success: true,
        message: 'Sales data deleted successfully'
      });
    } catch (error) {
      logger.logError('Sales data deletion failed', error as Error, {
        params: req.params,
        path: req.path
      });
      
      if (error instanceof NotFoundError) {
        res.status(404).json({ success: false, error: error.message });
      } else if (error instanceof ValidationError) {
        res.status(400).json({ success: false, error: error.message });
      } else {
        res.status(500).json({ success: false, error: 'Failed to delete sales data' });
      }
    }
  }
}