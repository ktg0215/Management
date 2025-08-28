import { Request, Response, NextFunction } from 'express';

interface RateLimitStore {
  [key: string]: {
    count: number;
    resetTime: number;
  };
}

class RateLimiter {
  private store: RateLimitStore = {};
  private cleanupInterval: NodeJS.Timeout;

  constructor() {
    // Clean up expired entries every 5 minutes
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 5 * 60 * 1000);
  }

  private cleanup() {
    const now = Date.now();
    for (const key in this.store) {
      if (this.store[key].resetTime < now) {
        delete this.store[key];
      }
    }
  }

  createLimiter(windowMs: number, maxRequests: number, keyGenerator?: (req: Request) => string) {
    return (req: Request, res: Response, next: NextFunction) => {
      const key = keyGenerator ? keyGenerator(req) : req.ip;
      const now = Date.now();
      
      if (!this.store[key] || this.store[key].resetTime < now) {
        this.store[key] = {
          count: 1,
          resetTime: now + windowMs
        };
        return next();
      }

      if (this.store[key].count >= maxRequests) {
        const remainingTime = Math.ceil((this.store[key].resetTime - now) / 1000);
        
        res.set({
          'X-RateLimit-Limit': maxRequests.toString(),
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': new Date(this.store[key].resetTime).toISOString(),
          'Retry-After': remainingTime.toString()
        });

        return res.status(429).json({
          success: false,
          error: 'Too many requests',
          retryAfter: remainingTime
        });
      }

      this.store[key].count++;
      
      res.set({
        'X-RateLimit-Limit': maxRequests.toString(),
        'X-RateLimit-Remaining': (maxRequests - this.store[key].count).toString(),
        'X-RateLimit-Reset': new Date(this.store[key].resetTime).toISOString()
      });

      next();
    };
  }

  destroy() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
  }
}

const rateLimiter = new RateLimiter();

// Different rate limits for different endpoints
export const generalRateLimit = rateLimiter.createLimiter(
  15 * 60 * 1000, // 15 minutes
  100 // 100 requests per window
);

export const authRateLimit = rateLimiter.createLimiter(
  15 * 60 * 1000, // 15 minutes
  5, // 5 login attempts per window
  (req: Request) => `auth:${req.ip}:${req.body.employeeId}`
);

export const bulkOperationRateLimit = rateLimiter.createLimiter(
  5 * 60 * 1000, // 5 minutes
  10 // 10 bulk operations per window
);

export const createRateLimit = rateLimiter.createLimiter(
  60 * 1000, // 1 minute
  20 // 20 create operations per minute
);

export default rateLimiter;