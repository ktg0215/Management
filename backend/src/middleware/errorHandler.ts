import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

export class AppError extends Error {
  public statusCode: number;
  public isOperational: boolean;
  public code?: string;

  constructor(message: string, statusCode: number = 500, isOperational: boolean = true) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.name = this.constructor.name;

    Error.captureStackTrace(this, this.constructor);
  }
}

// Database-specific errors
export class DatabaseError extends AppError {
  constructor(message: string, originalError?: Error) {
    super(`Database Error: ${message}`, 500);
    this.code = 'DATABASE_ERROR';
    
    if (originalError) {
      this.stack = originalError.stack;
    }
  }
}

export class ValidationError extends AppError {
  constructor(message: string, field?: string) {
    super(`Validation Error: ${message}`, 400);
    this.code = 'VALIDATION_ERROR';
  }
}

export class AuthenticationError extends AppError {
  constructor(message: string = 'Authentication failed') {
    super(message, 401);
    this.code = 'AUTHENTICATION_ERROR';
  }
}

export class AuthorizationError extends AppError {
  constructor(message: string = 'Insufficient permissions') {
    super(message, 403);
    this.code = 'AUTHORIZATION_ERROR';
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string) {
    super(`${resource} not found`, 404);
    this.code = 'NOT_FOUND';
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super(`Conflict: ${message}`, 409);
    this.code = 'CONFLICT';
  }
}

export class RateLimitError extends AppError {
  constructor(message: string = 'Too many requests') {
    super(message, 429);
    this.code = 'RATE_LIMIT_EXCEEDED';
  }
}

// Error classification helper
const classifyError = (error: any): { statusCode: number; message: string; code?: string } => {
  // PostgreSQL errors
  if (error.code) {
    switch (error.code) {
      case '23505': // Unique violation
        return { statusCode: 409, message: 'Resource already exists', code: 'DUPLICATE_ERROR' };
      case '23503': // Foreign key violation
        return { statusCode: 400, message: 'Referenced resource does not exist', code: 'FOREIGN_KEY_ERROR' };
      case '23514': // Check violation
        return { statusCode: 400, message: 'Data validation failed', code: 'CHECK_VIOLATION' };
      case '42P01': // Undefined table
        return { statusCode: 500, message: 'Database schema error', code: 'SCHEMA_ERROR' };
      case '28P01': // Invalid authorization
        return { statusCode: 500, message: 'Database connection failed', code: 'DB_AUTH_ERROR' };
      case '53300': // Too many connections
        return { statusCode: 503, message: 'Service temporarily unavailable', code: 'DB_CONNECTION_LIMIT' };
    }
  }

  // JWT errors
  if (error.name === 'JsonWebTokenError') {
    return { statusCode: 401, message: 'Invalid authentication token', code: 'INVALID_TOKEN' };
  }
  if (error.name === 'TokenExpiredError') {
    return { statusCode: 401, message: 'Authentication token expired', code: 'TOKEN_EXPIRED' };
  }

  // Express validation errors
  if (error.name === 'ValidationError') {
    return { statusCode: 400, message: error.message, code: 'VALIDATION_ERROR' };
  }

  // Default classification
  return { statusCode: 500, message: 'Internal server error', code: 'INTERNAL_ERROR' };
};

// Development error response
const sendErrorDev = (err: AppError, res: Response) => {
  res.status(err.statusCode).json({
    success: false,
    error: {
      message: err.message,
      code: err.code,
      stack: err.stack,
      statusCode: err.statusCode,
      isOperational: err.isOperational
    },
    timestamp: new Date().toISOString()
  });
};

// Production error response
const sendErrorProd = (err: AppError, res: Response) => {
  // Only send operational errors to client in production
  if (err.isOperational) {
    res.status(err.statusCode).json({
      success: false,
      error: {
        message: err.message,
        code: err.code
      },
      timestamp: new Date().toISOString()
    });
  } else {
    // Don't leak error details in production for non-operational errors
    res.status(500).json({
      success: false,
      error: {
        message: 'Something went wrong',
        code: 'INTERNAL_ERROR'
      },
      timestamp: new Date().toISOString()
    });
  }
};

// Main error handling middleware
export const globalErrorHandler = (err: any, req: Request, res: Response, next: NextFunction) => {
  // Generate request ID if not exists
  const requestId = req.headers['x-request-id'] || Math.random().toString(36).substr(2, 9);

  // Create AppError instance if it's not already one
  let appError: AppError;
  
  if (err instanceof AppError) {
    appError = err;
  } else {
    const classified = classifyError(err);
    appError = new AppError(classified.message, classified.statusCode, false);
    appError.code = classified.code;
  }

  // Log the error
  logger.error('Request Error', {
    requestId,
    error: {
      message: appError.message,
      code: appError.code,
      statusCode: appError.statusCode,
      stack: appError.stack,
      isOperational: appError.isOperational
    },
    request: {
      method: req.method,
      path: req.path,
      query: req.query,
      body: req.body,
      user: req.user?.id,
      ip: req.ip,
      userAgent: req.get('User-Agent')
    }
  });

  // Log security events
  if (appError.statusCode === 401 || appError.statusCode === 403) {
    logger.logSecurityEvent('Unauthorized Access', {
      path: req.path,
      method: req.method,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      userId: req.user?.id
    });
  }

  // Send error response
  if (process.env.NODE_ENV === 'development') {
    sendErrorDev(appError, res);
  } else {
    sendErrorProd(appError, res);
  }
};

// Catch 404 errors
export const notFoundHandler = (req: Request, res: Response, next: NextFunction) => {
  const error = new NotFoundError(`Route ${req.originalUrl}`);
  next(error);
};

// Async error wrapper
export const asyncHandler = (fn: Function) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

// Process error handlers
export const setupProcessErrorHandlers = () => {
  process.on('uncaughtException', (error: Error) => {
    logger.error('Uncaught Exception', {
      error: error.message,
      stack: error.stack
    });
    
    // Give the logger time to write, then exit
    setTimeout(() => {
      process.exit(1);
    }, 1000);
  });

  process.on('unhandledRejection', (reason: any, promise: Promise<any>) => {
    logger.error('Unhandled Rejection', {
      reason: reason?.message || reason,
      stack: reason?.stack
    });
    
    // Give the logger time to write, then exit
    setTimeout(() => {
      process.exit(1);
    }, 1000);
  });

  process.on('SIGTERM', () => {
    logger.info('SIGTERM received, shutting down gracefully');
    process.exit(0);
  });

  process.on('SIGINT', () => {
    logger.info('SIGINT received, shutting down gracefully');
    process.exit(0);
  });
};