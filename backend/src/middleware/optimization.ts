import { Request, Response, NextFunction } from 'express';
import compression from 'compression';

// Response optimization middleware
export const responseOptimization = (req: Request, res: Response, next: NextFunction) => {
  // Set performance headers
  res.set({
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block',
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
    'Cache-Control': 'no-cache, no-store, must-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0'
  });

  next();
};

// Smart compression middleware
export const smartCompression = compression({
  filter: (req: Request, res: Response) => {
    // Don't compress responses with this request header
    if (req.headers['x-no-compression']) {
      return false;
    }

    // Use compression filter function
    return compression.filter(req, res);
  },
  level: 6, // Balanced compression level
  threshold: 1024, // Only compress if response is larger than 1KB
});

// API response standardization middleware
export const standardizeApiResponse = (req: Request, res: Response, next: NextFunction) => {
  const originalJson = res.json;

  res.json = function(data: any) {
    // Standardize all API responses
    const standardResponse = {
      success: true,
      timestamp: new Date().toISOString(),
      path: req.path,
      method: req.method,
      ...data
    };

    return originalJson.call(this, standardResponse);
  };

  next();
};

// Request timing middleware
export const requestTiming = (req: Request, res: Response, next: NextFunction) => {
  const startTime = process.hrtime.bigint();
  
  res.on('finish', () => {
    const endTime = process.hrtime.bigint();
    const duration = Number(endTime - startTime) / 1000000; // Convert to milliseconds
    
    res.set('X-Response-Time', `${duration.toFixed(2)}ms`);
    
    // Log slow requests (>1000ms)
    if (duration > 1000) {
      console.warn(`🐌 Slow request: ${req.method} ${req.path} took ${duration.toFixed(2)}ms`);
    }
  });

  next();
};

// Memory usage monitoring
export const memoryMonitoring = (req: Request, res: Response, next: NextFunction) => {
  const memUsage = process.memoryUsage();
  const heapUsedMB = Math.round(memUsage.heapUsed / 1024 / 1024);
  
  // Warn if memory usage is high (>500MB)
  if (heapUsedMB > 500) {
    console.warn(`⚠️ High memory usage: ${heapUsedMB}MB heap used`);
  }

  res.set('X-Memory-Usage', `${heapUsedMB}MB`);
  next();
};