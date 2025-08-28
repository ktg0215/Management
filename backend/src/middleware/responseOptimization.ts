import { Request, Response, NextFunction } from 'express';
import compression from 'compression';
import { logger } from '../utils/logger';

// Field projection middleware
export interface ProjectionOptions {
  fields?: string[];
  exclude?: string[];
  includeMetadata?: boolean;
}

export function fieldProjection(options: ProjectionOptions = {}) {
  return (req: Request, res: Response, next: NextFunction) => {
    // Parse field selection from query parameters
    const fieldsParam = req.query.fields as string;
    const excludeParam = req.query.exclude as string;
    
    const requestedFields = fieldsParam 
      ? fieldsParam.split(',').map(f => f.trim())
      : options.fields;
    
    const excludeFields = excludeParam
      ? excludeParam.split(',').map(f => f.trim())
      : options.exclude || [];

    // Store projection options in request
    (req as any).projection = {
      fields: requestedFields,
      exclude: excludeFields,
      includeMetadata: options.includeMetadata ?? true
    };

    next();
  };
}

// Response projection utility
export function projectResponse(data: any, projection: any): any {
  if (!data || typeof data !== 'object') {
    return data;
  }

  if (Array.isArray(data)) {
    return data.map(item => projectResponse(item, projection));
  }

  const { fields, exclude } = projection;
  
  // If specific fields are requested, only include those
  if (fields && fields.length > 0) {
    const projected: any = {};
    fields.forEach(field => {
      if (field.includes('.')) {
        // Handle nested field selection (e.g., "user.name")
        const [parent, child] = field.split('.', 2);
        if (data[parent]) {
          if (!projected[parent]) projected[parent] = {};
          projected[parent][child] = data[parent][child];
        }
      } else if (data[field] !== undefined) {
        projected[field] = data[field];
      }
    });
    return projected;
  }

  // If exclude fields are specified, remove them
  if (exclude && exclude.length > 0) {
    const result = { ...data };
    exclude.forEach(field => {
      if (field.includes('.')) {
        const [parent, child] = field.split('.', 2);
        if (result[parent]) {
          delete result[parent][child];
        }
      } else {
        delete result[field];
      }
    });
    return result;
  }

  return data;
}

// Enhanced response wrapper with optimization
export function optimizedResponse() {
  return (req: Request, res: Response, next: NextFunction) => {
    const startTime = Date.now();
    
    // Store original json method
    const originalJson = res.json;
    
    res.json = function(data: any) {
      const projection = (req as any).projection;
      
      // Apply field projection if configured
      let responseData = data;
      if (projection) {
        if (data && data.data) {
          // Handle standard response format { data: [...], metadata: {...} }
          responseData = {
            ...data,
            data: projectResponse(data.data, projection)
          };
        } else {
          responseData = projectResponse(data, projection);
        }
      }

      // Add response metadata if enabled
      if (projection?.includeMetadata !== false) {
        const responseTime = Date.now() - startTime;
        
        if (typeof responseData === 'object' && responseData !== null) {
          responseData._metadata = {
            responseTime,
            timestamp: new Date().toISOString(),
            compressed: !!req.get('accept-encoding')?.includes('gzip'),
            fieldsProjected: !!(projection?.fields || projection?.exclude)
          };
        }

        // Log slow responses
        if (responseTime > 500) {
          logger.logPerformance('Slow API Response', responseTime, {
            path: req.path,
            method: req.method,
            statusCode: res.statusCode
          });
        }
      }

      return originalJson.call(this, responseData);
    };

    next();
  };
}

// Response compression with dynamic level based on data size
export const dynamicCompression = compression({
  filter: (req, res) => {
    if (req.headers['x-no-compression']) {
      return false;
    }
    return compression.filter(req, res);
  },
  level: (req, res) => {
    const contentLength = res.get('Content-Length');
    if (contentLength && parseInt(contentLength) > 10000) {
      return 9; // Maximum compression for large responses
    }
    return 6; // Default compression level
  },
  threshold: 1024 // Only compress responses larger than 1KB
});

// Pagination middleware
export interface PaginationOptions {
  defaultLimit?: number;
  maxLimit?: number;
  includeTotalCount?: boolean;
}

export function pagination(options: PaginationOptions = {}) {
  return (req: Request, res: Response, next: NextFunction) => {
    const defaultLimit = options.defaultLimit || 50;
    const maxLimit = options.maxLimit || 1000;
    
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(
      maxLimit,
      Math.max(1, parseInt(req.query.limit as string) || defaultLimit)
    );
    const offset = (page - 1) * limit;

    (req as any).pagination = {
      page,
      limit,
      offset,
      includeTotalCount: options.includeTotalCount !== false
    };

    // Override response.json to add pagination metadata
    const originalJson = res.json;
    res.json = function(data: any) {
      if (data && Array.isArray(data.data)) {
        const paginatedData = {
          data: data.data,
          pagination: {
            page,
            limit,
            total: data.total || data.data.length,
            totalPages: data.total ? Math.ceil(data.total / limit) : 1,
            hasNextPage: data.total ? page * limit < data.total : false,
            hasPrevPage: page > 1
          }
        };
        
        // Include any additional metadata
        if (data._metadata) {
          paginatedData._metadata = data._metadata;
        }
        
        return originalJson.call(this, paginatedData);
      }
      
      return originalJson.call(this, data);
    };

    next();
  };
}

// Response caching headers
export function cacheHeaders(ttl: number = 300) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (req.method === 'GET') {
      res.set({
        'Cache-Control': `public, max-age=${ttl}`,
        'ETag': generateETag(req.url),
        'Vary': 'Accept-Encoding, Accept'
      });
      
      // Handle conditional requests
      const clientETag = req.get('If-None-Match');
      const serverETag = res.get('ETag');
      
      if (clientETag && serverETag && clientETag === serverETag) {
        return res.status(304).end();
      }
    }
    
    next();
  };
}

// Simple ETag generation
function generateETag(url: string): string {
  const hash = require('crypto').createHash('md5');
  hash.update(url + Date.now().toString());
  return `"${hash.digest('hex')}"`;
}

// Response time tracking
export function responseTimeTracking() {
  return (req: Request, res: Response, next: NextFunction) => {
    const startTime = process.hrtime.bigint();
    
    res.on('finish', () => {
      const endTime = process.hrtime.bigint();
      const duration = Number(endTime - startTime) / 1000000; // Convert to milliseconds
      
      // Add response time header
      res.set('X-Response-Time', `${duration.toFixed(2)}ms`);
      
      // Log API performance
      logger.logApiPerformance(req.method, req.path, res.statusCode, duration);
    });
    
    next();
  };
}