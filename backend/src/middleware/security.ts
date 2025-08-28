import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { logger } from '../utils/logger';

// Security configuration
const SECURITY_CONFIG = {
  JWT_SECRET: process.env.JWT_SECRET || 'your-super-secure-secret',
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '7d',
  BCRYPT_ROUNDS: parseInt(process.env.BCRYPT_ROUNDS || '12'),
  MAX_LOGIN_ATTEMPTS: parseInt(process.env.MAX_LOGIN_ATTEMPTS || '5'),
  LOCKOUT_TIME: parseInt(process.env.LOCKOUT_TIME || '900000'), // 15 minutes
  RATE_LIMIT_WINDOW: parseInt(process.env.RATE_LIMIT_WINDOW || '900000'), // 15 minutes
  RATE_LIMIT_MAX: parseInt(process.env.RATE_LIMIT_MAX || '100'),
};

// Failed login attempts tracking
const failedAttempts = new Map<string, { count: number; lockUntil: number }>();

// JWT token blacklist (for logout functionality)
const tokenBlacklist = new Set<string>();

// Input sanitization
export const sanitizeInput = (req: Request, res: Response, next: NextFunction) => {
  const sanitizeObject = (obj: any): any => {
    if (typeof obj === 'string') {
      return obj.trim().replace(/[<>]/g, ''); // Basic XSS prevention
    }
    if (Array.isArray(obj)) {
      return obj.map(sanitizeObject);
    }
    if (obj && typeof obj === 'object') {
      const sanitized: any = {};
      for (const [key, value] of Object.entries(obj)) {
        sanitized[key] = sanitizeObject(value);
      }
      return sanitized;
    }
    return obj;
  };

  req.body = sanitizeObject(req.body);
  req.query = sanitizeObject(req.query);
  req.params = sanitizeObject(req.params);

  next();
};

// SQL injection prevention for dynamic queries
export const validateQueryParams = (req: Request, res: Response, next: NextFunction) => {
  const suspiciousPatterns = [
    /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|UNION|SCRIPT)\b)/i,
    /['"`;]/,
    /(--|\*\/|\/\*)/,
    /(\bOR\b|\bAND\b).*[=<>]/i
  ];

  const checkValue = (value: string): boolean => {
    return suspiciousPatterns.some(pattern => pattern.test(value));
  };

  const checkObject = (obj: any): boolean => {
    for (const [key, value] of Object.entries(obj)) {
      if (typeof value === 'string' && checkValue(value)) {
        return true;
      }
      if (typeof value === 'object' && value !== null && checkObject(value)) {
        return true;
      }
    }
    return false;
  };

  if (checkObject(req.query) || checkObject(req.body) || checkObject(req.params)) {
    logger.logSecurityEvent('Potential SQL Injection', {
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      path: req.path,
      method: req.method,
      query: req.query,
      body: req.body
    });

    return res.status(400).json({
      success: false,
      error: 'Invalid request parameters'
    });
  }

  next();
};

// Enhanced JWT authentication with blacklist checking
export const authenticateToken = (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({
      success: false,
      error: 'Access token required'
    });
  }

  // Check if token is blacklisted
  if (tokenBlacklist.has(token)) {
    return res.status(401).json({
      success: false,
      error: 'Token has been revoked'
    });
  }

  jwt.verify(token, SECURITY_CONFIG.JWT_SECRET, (err: any, user: any) => {
    if (err) {
      logger.logSecurityEvent('Invalid Token Usage', {
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        error: err.message
      });

      return res.status(403).json({
        success: false,
        error: 'Invalid or expired token'
      });
    }

    (req as any).user = user;
    next();
  });
};

// Role-based authorization
export const authorize = (roles: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = (req as any).user;
    
    if (!user || !roles.includes(user.role)) {
      logger.logSecurityEvent('Unauthorized Access Attempt', {
        userId: user?.id,
        userRole: user?.role,
        requiredRoles: roles,
        ip: req.ip,
        path: req.path,
        method: req.method
      });

      return res.status(403).json({
        success: false,
        error: 'Insufficient permissions'
      });
    }

    next();
  };
};

// Account lockout mechanism
export const checkAccountLockout = (identifier: string): boolean => {
  const attempt = failedAttempts.get(identifier);
  
  if (attempt && attempt.count >= SECURITY_CONFIG.MAX_LOGIN_ATTEMPTS) {
    if (Date.now() < attempt.lockUntil) {
      return true; // Account is locked
    } else {
      // Lockout period expired, reset attempts
      failedAttempts.delete(identifier);
    }
  }
  
  return false;
};

// Record failed login attempt
export const recordFailedAttempt = (identifier: string): void => {
  const attempt = failedAttempts.get(identifier) || { count: 0, lockUntil: 0 };
  attempt.count++;
  
  if (attempt.count >= SECURITY_CONFIG.MAX_LOGIN_ATTEMPTS) {
    attempt.lockUntil = Date.now() + SECURITY_CONFIG.LOCKOUT_TIME;
  }
  
  failedAttempts.set(identifier, attempt);
};

// Clear failed attempts on successful login
export const clearFailedAttempts = (identifier: string): void => {
  failedAttempts.delete(identifier);
};

// Enhanced password hashing
export const hashPassword = async (password: string): Promise<string> => {
  return bcrypt.hash(password, SECURITY_CONFIG.BCRYPT_ROUNDS);
};

// Password strength validation
export const validatePasswordStrength = (password: string): { valid: boolean; errors: string[] } => {
  const errors: string[] = [];
  
  if (password.length < 8) {
    errors.push('Password must be at least 8 characters long');
  }
  
  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }
  
  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }
  
  if (!/\d/.test(password)) {
    errors.push('Password must contain at least one number');
  }
  
  if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
    errors.push('Password must contain at least one special character');
  }

  return { valid: errors.length === 0, errors };
};

// JWT token generation with enhanced security
export const generateToken = (payload: any): string => {
  const tokenPayload = {
    ...payload,
    iat: Math.floor(Date.now() / 1000),
    jti: crypto.randomUUID() // Unique token ID
  };

  return jwt.sign(tokenPayload, SECURITY_CONFIG.JWT_SECRET, {
    expiresIn: SECURITY_CONFIG.JWT_EXPIRES_IN,
    issuer: 'sales-management-system',
    audience: 'sales-management-client'
  });
};

// Token blacklisting for logout
export const blacklistToken = (token: string): void => {
  tokenBlacklist.add(token);
  
  // Clean up expired tokens periodically
  if (tokenBlacklist.size > 10000) {
    cleanupBlacklist();
  }
};

// Clean up expired tokens from blacklist
const cleanupBlacklist = (): void => {
  const expiredTokens: string[] = [];
  
  tokenBlacklist.forEach(token => {
    try {
      jwt.verify(token, SECURITY_CONFIG.JWT_SECRET);
    } catch (err) {
      if (err.name === 'TokenExpiredError') {
        expiredTokens.push(token);
      }
    }
  });
  
  expiredTokens.forEach(token => tokenBlacklist.delete(token));
};

// Request ID middleware for tracing
export const requestId = (req: Request, res: Response, next: NextFunction) => {
  req.headers['x-request-id'] = req.headers['x-request-id'] || crypto.randomUUID();
  res.set('X-Request-ID', req.headers['x-request-id']);
  next();
};

// Security headers middleware
export const securityHeaders = (req: Request, res: Response, next: NextFunction) => {
  res.set({
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'geolocation=(), microphone=(), camera=()',
    'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:;",
  });
  
  if (req.secure) {
    res.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  
  next();
};

// Clean up old failed attempts periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, attempt] of failedAttempts.entries()) {
    if (attempt.lockUntil < now) {
      failedAttempts.delete(key);
    }
  }
}, 60000); // Clean up every minute