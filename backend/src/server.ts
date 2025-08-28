import express from 'express';
import { createServer } from 'http';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';

// Import optimized components
import { optimizedPool } from './database/optimizedPool';
import { WebSocketManager } from './websocket/WebSocketServer';
import { RealTimeEventHandlers } from './websocket/eventHandlers';
import { createOptimizedSalesRoutes } from './routes/optimizedSalesRoutes';
import { 
  dynamicCompression,
  responseTimeTracking,
  optimizedResponse,
  pagination,
  fieldProjection
} from './middleware/responseOptimization';
import { cacheService } from './cache/redisCache';
import { logger } from './utils/logger';

// Load environment variables
dotenv.config();

interface ServerConfig {
  port: number;
  host: string;
  nodeEnv: string;
}

class OptimizedServer {
  private app: express.Application;
  private server: any;
  private wsManager: WebSocketManager | null = null;
  private eventHandlers: RealTimeEventHandlers | null = null;
  private config: ServerConfig;

  constructor() {
    this.config = {
      port: parseInt(process.env.PORT || '3001'),
      host: process.env.HOST || '0.0.0.0',
      nodeEnv: process.env.NODE_ENV || 'development'
    };

    this.app = express();
    this.server = createServer(this.app);
    
    this.initializeMiddleware();
    this.initializeWebSocket();
    this.initializeRoutes();
    this.initializeErrorHandling();
    this.setupGracefulShutdown();
  }

  private initializeMiddleware(): void {
    // Security middleware
    this.app.use(helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          scriptSrc: ["'self'"],
          imgSrc: ["'self'", "data:", "https:"],
          connectSrc: ["'self'", "ws:", "wss:"],
          fontSrc: ["'self'"],
          objectSrc: ["'none'"],
          mediaSrc: ["'self'"],
          frameSrc: ["'none'"]
        }
      },
      crossOriginEmbedderPolicy: false
    }));

    // CORS configuration
    this.app.use(cors({
      origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
      maxAge: 86400 // 24 hours
    }));

    // Request parsing
    this.app.use(express.json({ 
      limit: '10mb',
      verify: (req, res, buf) => {
        // Log large requests
        if (buf.length > 1024 * 1024) { // 1MB
          logger.logWarning('Large request body detected', {
            size: buf.length,
            path: (req as any).path,
            method: (req as any).method
          });
        }
      }
    }));

    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    // Compression middleware
    this.app.use(dynamicCompression);

    // Request logging
    this.app.use(morgan('combined', {
      stream: {
        write: (message: string) => {
          logger.logInfo('HTTP Request', { message: message.trim() });
        }
      }
    }));

    // Performance tracking
    this.app.use(responseTimeTracking());

    // Request ID for tracing
    this.app.use((req, res, next) => {
      const requestId = require('crypto').randomUUID();
      (req as any).requestId = requestId;
      res.setHeader('X-Request-ID', requestId);
      next();
    });

    // Request rate limiting (basic implementation)
    const requestCounts = new Map<string, { count: number; resetTime: number }>();
    
    this.app.use((req, res, next) => {
      const clientIP = req.ip || req.connection.remoteAddress || 'unknown';
      const now = Date.now();
      const windowMs = 60000; // 1 minute
      const maxRequests = 100;

      if (!requestCounts.has(clientIP)) {
        requestCounts.set(clientIP, { count: 1, resetTime: now + windowMs });
        return next();
      }

      const clientData = requestCounts.get(clientIP)!;

      if (now > clientData.resetTime) {
        clientData.count = 1;
        clientData.resetTime = now + windowMs;
        return next();
      }

      if (clientData.count >= maxRequests) {
        logger.logWarning('Rate limit exceeded', { clientIP, requests: clientData.count });
        return res.status(429).json({
          error: 'Too Many Requests',
          retryAfter: Math.ceil((clientData.resetTime - now) / 1000)
        });
      }

      clientData.count++;
      next();
    });
  }

  private initializeWebSocket(): void {
    try {
      this.wsManager = new WebSocketManager(this.server, optimizedPool as any);
      this.eventHandlers = new RealTimeEventHandlers({
        pool: optimizedPool as any,
        wsManager: this.wsManager
      });

      logger.logInfo('WebSocket server initialized successfully');
    } catch (error) {
      logger.logError('Failed to initialize WebSocket server', error as Error);
    }
  }

  private initializeRoutes(): void {
    // Health check endpoint
    this.app.get('/health', async (req, res) => {
      const dbHealth = await optimizedPool.healthCheck();
      const cacheHealth = await cacheService.isHealthy();
      const wsStats = this.wsManager?.getConnectionStats();

      const health = {
        status: dbHealth.healthy && cacheHealth ? 'healthy' : 'unhealthy',
        timestamp: new Date().toISOString(),
        services: {
          database: dbHealth,
          cache: { healthy: cacheHealth },
          websocket: wsStats ? { healthy: true, ...wsStats } : { healthy: false },
          memory: {
            used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
            total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024)
          }
        }
      };

      res.status(health.status === 'healthy' ? 200 : 503).json(health);
    });

    // Metrics endpoint (admin only)
    this.app.get('/metrics', async (req, res) => {
      try {
        const dbStats = optimizedPool.getStats();
        const cacheStats = cacheService.getCacheStats();
        const wsStats = this.wsManager?.getConnectionStats();

        const metrics = {
          database: dbStats,
          cache: cacheStats,
          websocket: wsStats || null,
          system: {
            uptime: process.uptime(),
            memory: process.memoryUsage(),
            cpu: process.cpuUsage()
          },
          timestamp: new Date().toISOString()
        };

        res.json(metrics);
      } catch (error) {
        logger.logError('Failed to get metrics', error as Error);
        res.status(500).json({ error: 'Failed to retrieve metrics' });
      }
    });

    // API Routes with optimization middleware
    this.app.use('/api/v1', optimizedResponse());

    // Legacy API routes (existing routes from index.ts can be moved here)
    this.app.use('/api', optimizedResponse());

    // Optimized Sales API routes
    if (this.wsManager) {
      const optimizedSalesRoutes = createOptimizedSalesRoutes({
        pool: optimizedPool as any,
        wsManager: this.wsManager
      });
      
      this.app.use('/api/v2/sales', optimizedSalesRoutes);
    }

    // Cache management endpoints (admin only)
    this.app.post('/api/admin/cache/clear', async (req, res) => {
      try {
        cacheService.resetStats();
        optimizedPool.clearQueryCache();
        
        if (this.wsManager) {
          this.wsManager.broadcastSystemAnnouncement(
            'System cache cleared by administrator',
            { action: 'cache_clear', timestamp: new Date().toISOString() }
          );
        }

        res.json({ 
          success: true, 
          message: 'All caches cleared successfully',
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        logger.logError('Failed to clear cache', error as Error);
        res.status(500).json({ error: 'Failed to clear cache' });
      }
    });

    // WebSocket connection stats
    this.app.get('/api/admin/websocket/stats', (req, res) => {
      if (!this.wsManager) {
        return res.status(503).json({ error: 'WebSocket server not available' });
      }

      const stats = this.wsManager.getConnectionStats();
      res.json(stats);
    });

    // API Documentation endpoint
    this.app.get('/api', (req, res) => {
      res.json({
        name: 'Sales Management API',
        version: '2.0.0',
        description: 'Optimized sales management system with real-time capabilities',
        endpoints: {
          '/api/v1': 'Legacy API endpoints',
          '/api/v2/sales': 'Optimized sales management API with field projection and caching',
          '/health': 'System health check',
          '/metrics': 'Performance metrics and statistics',
          '/ws': 'WebSocket endpoint for real-time updates'
        },
        features: [
          'Field projection for optimized responses',
          'Advanced caching with Redis',
          'Real-time WebSocket updates',
          'Batch API operations',
          'Query performance monitoring',
          'Automatic database optimization'
        ],
        timestamp: new Date().toISOString()
      });
    });

    // 404 handler
    this.app.use('*', (req, res) => {
      logger.logWarning('Route not found', {
        method: req.method,
        path: req.originalUrl,
        ip: req.ip
      });

      res.status(404).json({
        error: 'Not Found',
        message: 'The requested resource does not exist',
        path: req.originalUrl,
        timestamp: new Date().toISOString()
      });
    });
  }

  private initializeErrorHandling(): void {
    // Global error handler
    this.app.use((error: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
      const requestId = (req as any).requestId;
      
      logger.logError('Unhandled application error', error, {
        requestId,
        method: req.method,
        path: req.path,
        ip: req.ip,
        userAgent: req.get('User-Agent')
      });

      // Don't expose internal errors in production
      const isDevelopment = this.config.nodeEnv === 'development';
      
      res.status(500).json({
        error: 'Internal Server Error',
        message: isDevelopment ? error.message : 'Something went wrong',
        requestId,
        timestamp: new Date().toISOString(),
        ...(isDevelopment && { stack: error.stack })
      });
    });

    // Handle unhandled promise rejections
    process.on('unhandledRejection', (reason: any, promise: Promise<any>) => {
      logger.logError('Unhandled Promise Rejection', new Error(reason), {
        promise: promise.toString()
      });
    });

    // Handle uncaught exceptions
    process.on('uncaughtException', (error: Error) => {
      logger.logError('Uncaught Exception', error);
      
      // Graceful shutdown on uncaught exception
      this.shutdown('SIGTERM').then(() => {
        process.exit(1);
      });
    });
  }

  private setupGracefulShutdown(): void {
    const signals: NodeJS.Signals[] = ['SIGTERM', 'SIGINT', 'SIGUSR2'];

    signals.forEach((signal) => {
      process.on(signal, async () => {
        logger.logInfo(`Received ${signal}, starting graceful shutdown...`);
        await this.shutdown(signal);
        process.exit(0);
      });
    });
  }

  private async shutdown(signal: string): Promise<void> {
    logger.logInfo(`Shutting down server (${signal})...`);

    // Close HTTP server
    if (this.server) {
      this.server.close(() => {
        logger.logInfo('HTTP server closed');
      });
    }

    // Close WebSocket connections
    if (this.wsManager) {
      this.wsManager.shutdown();
    }

    // Close database connections
    try {
      await optimizedPool.close();
      logger.logInfo('Database connections closed');
    } catch (error) {
      logger.logError('Error closing database connections', error as Error);
    }

    // Close cache connections
    try {
      await cacheService.close();
      logger.logInfo('Cache connections closed');
    } catch (error) {
      logger.logError('Error closing cache connections', error as Error);
    }

    logger.logInfo('Graceful shutdown completed');
  }

  public async start(): Promise<void> {
    try {
      // Wait for database connection
      const dbHealth = await optimizedPool.healthCheck();
      if (!dbHealth.healthy) {
        throw new Error('Database health check failed');
      }

      // Start server
      this.server.listen(this.config.port, this.config.host, () => {
        logger.logInfo(`🚀 Optimized server started successfully`, {
          port: this.config.port,
          host: this.config.host,
          nodeEnv: this.config.nodeEnv,
          features: [
            'Field Projection',
            'Dynamic Compression',
            'WebSocket Real-time Updates',
            'Advanced Caching',
            'Query Optimization',
            'Performance Monitoring'
          ]
        });
      });

      // Log system information
      setTimeout(() => {
        logger.logInfo('System status after startup', {
          memory: process.memoryUsage(),
          uptime: process.uptime(),
          database: dbHealth,
          cache: cacheService.getCacheStats(),
          websocket: this.wsManager?.getConnectionStats()
        });
      }, 5000);

    } catch (error) {
      logger.logError('Failed to start server', error as Error);
      process.exit(1);
    }
  }

  // Getter for external access
  public getApp(): express.Application {
    return this.app;
  }

  public getWSManager(): WebSocketManager | null {
    return this.wsManager;
  }

  public getEventHandlers(): RealTimeEventHandlers | null {
    return this.eventHandlers;
  }
}

// Create and export server instance
const optimizedServer = new OptimizedServer();

// Start server if this file is run directly
if (require.main === module) {
  optimizedServer.start().catch((error) => {
    logger.logError('Failed to start server', error);
    process.exit(1);
  });
}

export { optimizedServer };
export default optimizedServer;