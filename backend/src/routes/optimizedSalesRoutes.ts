import { Router } from 'express';
import { Pool } from 'pg';
import { SalesController } from '../controllers/SalesController';
import { RealTimeEventHandlers } from '../websocket/eventHandlers';
import { WebSocketManager } from '../websocket/WebSocketServer';
import { 
  fieldProjection, 
  optimizedResponse, 
  pagination, 
  cacheHeaders,
  responseTimeTracking
} from '../middleware/responseOptimization';
import { authenticateToken } from '../middleware/auth';
import { validateRequest } from '../middleware/validation';
import { body, query, param } from 'express-validator';

interface OptimizedSalesRoutesOptions {
  pool: Pool;
  wsManager: WebSocketManager;
}

export function createOptimizedSalesRoutes(options: OptimizedSalesRoutesOptions): Router {
  const router = Router();
  const { pool, wsManager } = options;
  
  const salesController = new SalesController(pool);
  const eventHandlers = new RealTimeEventHandlers({ pool, wsManager });

  // Apply common middleware
  router.use(authenticateToken);
  router.use(responseTimeTracking());
  router.use(optimizedResponse());

  // GET /api/v2/sales - Get sales data with field projection and caching
  router.get('/',
    cacheHeaders(300), // 5 minutes cache
    fieldProjection({ 
      exclude: ['created_at', 'updated_at'],
      includeMetadata: true 
    }),
    pagination({ defaultLimit: 50, maxLimit: 200 }),
    validateRequest([
      query('year').isInt({ min: 2020, max: 2030 }),
      query('month').isInt({ min: 1, max: 12 }),
      query('storeId').isUUID()
    ]),
    async (req, res) => {
      await salesController.getSalesData(req, res);
    }
  );

  // GET /api/v2/sales/aggregated - Get aggregated sales data
  router.get('/aggregated',
    cacheHeaders(600), // 10 minutes cache
    fieldProjection({ includeMetadata: true }),
    pagination({ defaultLimit: 100, maxLimit: 500 }),
    validateRequest([
      query('year').isInt({ min: 2020, max: 2030 }),
      query('month').isInt({ min: 1, max: 12 }),
      query('businessType').optional().isString()
    ]),
    async (req, res) => {
      await salesController.getAggregatedSalesData(req, res);
    }
  );

  // GET /api/v2/sales/analytics - Get sales analytics
  router.get('/analytics',
    cacheHeaders(1800), // 30 minutes cache
    fieldProjection({ includeMetadata: true }),
    validateRequest([
      query('storeId').isUUID(),
      query('startYear').optional().isInt({ min: 2020, max: 2030 }),
      query('endYear').optional().isInt({ min: 2020, max: 2030 }),
      query('metrics').optional().isString()
    ]),
    async (req, res) => {
      await salesController.getSalesAnalytics(req, res);
    }
  );

  // GET /api/v2/sales/date-range - Get sales data by date range
  router.get('/date-range',
    cacheHeaders(300),
    fieldProjection({ includeMetadata: true }),
    pagination({ defaultLimit: 50, maxLimit: 200 }),
    validateRequest([
      query('storeId').isUUID(),
      query('startDate').isISO8601(),
      query('endDate').isISO8601()
    ]),
    async (req, res) => {
      await salesController.getSalesDataByDateRange(req, res);
    }
  );

  // GET /api/v2/sales/export - Export sales data with streaming
  router.get('/export',
    validateRequest([
      query('storeId').isUUID(),
      query('format').optional().isIn(['json', 'csv']),
      query('year').optional().isInt({ min: 2020, max: 2030 }),
      query('month').optional().isInt({ min: 1, max: 12 })
    ]),
    async (req, res) => {
      await salesController.exportSalesData(req, res);
    }
  );

  // POST /api/v2/sales - Create single sales data with real-time updates
  router.post('/',
    validateRequest([
      body('storeId').isUUID(),
      body('year').isInt({ min: 2020, max: 2030 }),
      body('month').isInt({ min: 1, max: 12 }),
      body('dailyData').isObject()
    ]),
    async (req, res) => {
      try {
        // Create sales data
        const salesData = await salesController.getSalesService().createOrUpdateSalesData({
          storeId: req.body.storeId,
          year: req.body.year,
          month: req.body.month,
          dailyData: req.body.dailyData,
          createdBy: (req as any).user.id,
          updatedBy: (req as any).user.id
        });

        // Trigger real-time event
        if (salesData) {
          await eventHandlers.handleSalesDataCreation(
            req.body.storeId,
            req.body.year,
            req.body.month,
            req.body.dailyData,
            (req as any).user.id
          );
        }

        res.json({
          success: true,
          data: salesData,
          message: 'Sales data created successfully'
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          error: 'Failed to create sales data'
        });
      }
    }
  );

  // POST /api/v2/sales/batch - Batch create/update sales data
  router.post('/batch',
    validateRequest([
      body('salesDataArray').isArray({ min: 1, max: 100 }),
      body('salesDataArray.*.storeId').isUUID(),
      body('salesDataArray.*.year').isInt({ min: 2020, max: 2030 }),
      body('salesDataArray.*.month').isInt({ min: 1, max: 12 }),
      body('salesDataArray.*.dailyData').isObject()
    ]),
    async (req, res) => {
      try {
        // Process batch operation
        const result = await salesController.getSalesService().batchUpsertSalesData(
          req.body.salesDataArray,
          (req as any).user.id
        );

        // Trigger real-time batch event
        await eventHandlers.handleBatchSalesDataUpdate(
          result.results.map(r => ({
            storeId: req.body.salesDataArray[result.results.indexOf(r)]?.storeId || '',
            year: req.body.salesDataArray[result.results.indexOf(r)]?.year || 0,
            month: req.body.salesDataArray[result.results.indexOf(r)]?.month || 0,
            status: r.status
          })),
          (req as any).user.id
        );

        res.json({
          success: true,
          data: result,
          message: `Batch operation completed: ${result.processed} processed, ${result.created} created, ${result.updated} updated, ${result.failed} failed`
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          error: 'Failed to process batch sales data'
        });
      }
    }
  );

  // PUT /api/v2/sales/:id - Update sales data with real-time updates
  router.put('/:id',
    validateRequest([
      param('id').isUUID(),
      body('dailyData').isObject()
    ]),
    async (req, res) => {
      try {
        const salesData = await salesController.getSalesService().findById(req.params.id);
        if (!salesData) {
          return res.status(404).json({
            success: false,
            error: 'Sales data not found'
          });
        }

        const updatedData = await salesController.getSalesService().update(req.params.id, {
          daily_data: JSON.stringify(req.body.dailyData),
          updated_by: (req as any).user.id
        });

        // Trigger real-time event
        await eventHandlers.handleSalesDataUpdate(
          salesData.store_id,
          salesData.year,
          salesData.month,
          req.body.dailyData,
          (req as any).user.id
        );

        res.json({
          success: true,
          data: updatedData,
          message: 'Sales data updated successfully'
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          error: 'Failed to update sales data'
        });
      }
    }
  );

  // DELETE /api/v2/sales/:id - Delete sales data
  router.delete('/:id',
    validateRequest([
      param('id').isUUID()
    ]),
    async (req, res) => {
      await salesController.deleteSalesData(req, res);
    }
  );

  // DELETE /api/v2/sales/bulk - Bulk delete sales data
  router.delete('/bulk',
    validateRequest([
      body('ids').isArray({ min: 1, max: 100 }),
      body('ids.*').isUUID()
    ]),
    async (req, res) => {
      try {
        const deletedCount = await salesController.getSalesService().bulkDeleteSalesData(
          req.body.ids,
          (req as any).user.id
        );

        // Broadcast system update
        wsManager.broadcastSystemAnnouncement(
          `Bulk deletion completed: ${deletedCount} sales records deleted`,
          {
            type: 'bulk-delete-completed',
            deletedCount,
            requestedCount: req.body.ids.length,
            userId: (req as any).user.id
          }
        );

        res.json({
          success: true,
          data: {
            deletedCount,
            requestedCount: req.body.ids.length
          },
          message: `Successfully deleted ${deletedCount} sales records`
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          error: 'Failed to delete sales data'
        });
      }
    }
  );

  // GET /api/v2/sales/ws-stats - WebSocket connection statistics (admin only)
  router.get('/ws-stats',
    validateRequest([]),
    async (req, res) => {
      try {
        const user = (req as any).user;
        
        if (!['admin', 'super_admin'].includes(user.role)) {
          return res.status(403).json({
            success: false,
            error: 'Access denied'
          });
        }

        const wsStats = wsManager.getConnectionStats();
        const eventStats = eventHandlers.getEventHandlerStats();

        res.json({
          success: true,
          data: {
            websocket: wsStats,
            eventHandlers: eventStats,
            timestamp: new Date().toISOString()
          }
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          error: 'Failed to get WebSocket statistics'
        });
      }
    }
  );

  return router;
}

// Middleware function to add sales controller method access
declare global {
  namespace Express {
    interface Request {
      salesController?: SalesController;
    }
  }
}

// Helper middleware to attach sales controller to request
export function attachSalesController(pool: Pool) {
  return (req: any, res: any, next: any) => {
    req.salesController = new SalesController(pool);
    next();
  };
}

// Enhanced authentication middleware for WebSocket token validation
export function authenticateToken(req: any, res: any, next: any): void {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ success: false, error: 'Access token required' });
  }

  try {
    const jwt = require('jsonwebtoken');
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'default-secret');
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(403).json({ success: false, error: 'Invalid access token' });
  }
}

// Validation middleware wrapper
export function validateRequest(validations: any[]) {
  return async (req: any, res: any, next: any) => {
    const { validationResult } = require('express-validator');
    
    await Promise.all(validations.map(validation => validation.run(req)));

    const errors = validationResult(req);
    if (errors.isEmpty()) {
      return next();
    }

    res.status(400).json({
      success: false,
      error: 'Validation failed',
      details: errors.array()
    });
  };
}