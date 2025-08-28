import * as fs from 'fs';
import * as path from 'path';

enum LogLevel {
  ERROR = 0,
  WARN = 1,
  INFO = 2,
  DEBUG = 3
}

interface LogEntry {
  timestamp: string;
  level: string;
  message: string;
  meta?: any;
  requestId?: string;
  userId?: string;
  ip?: string;
  userAgent?: string;
  method?: string;
  path?: string;
  statusCode?: number;
  responseTime?: number;
}

class Logger {
  private logLevel: LogLevel;
  private logDir: string;
  private maxFileSize: number = 50 * 1024 * 1024; // 50MB
  private maxFiles: number = 10;

  constructor() {
    this.logLevel = this.getLogLevel();
    this.logDir = process.env.LOG_DIR || path.join(process.cwd(), 'logs');
    this.ensureLogDirectory();
  }

  private getLogLevel(): LogLevel {
    const level = process.env.LOG_LEVEL?.toUpperCase() || 'INFO';
    return LogLevel[level as keyof typeof LogLevel] ?? LogLevel.INFO;
  }

  private ensureLogDirectory(): void {
    if (!fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true });
    }
  }

  private formatLogEntry(level: string, message: string, meta?: any): LogEntry {
    return {
      timestamp: new Date().toISOString(),
      level: level.toUpperCase(),
      message,
      meta,
    };
  }

  private writeToFile(filename: string, logEntry: LogEntry): void {
    const logFile = path.join(this.logDir, filename);
    const logString = JSON.stringify(logEntry) + '\n';

    // Check file size and rotate if necessary
    this.rotateLogFileIfNeeded(logFile);

    fs.appendFileSync(logFile, logString, 'utf8');
  }

  private rotateLogFileIfNeeded(logFile: string): void {
    try {
      const stats = fs.statSync(logFile);
      if (stats.size > this.maxFileSize) {
        this.rotateLogFile(logFile);
      }
    } catch (error) {
      // File doesn't exist yet, no need to rotate
    }
  }

  private rotateLogFile(logFile: string): void {
    const dir = path.dirname(logFile);
    const ext = path.extname(logFile);
    const basename = path.basename(logFile, ext);

    // Rotate existing files
    for (let i = this.maxFiles - 1; i >= 1; i--) {
      const oldFile = path.join(dir, `${basename}.${i}${ext}`);
      const newFile = path.join(dir, `${basename}.${i + 1}${ext}`);
      
      if (fs.existsSync(oldFile)) {
        if (i === this.maxFiles - 1) {
          fs.unlinkSync(oldFile); // Delete oldest file
        } else {
          fs.renameSync(oldFile, newFile);
        }
      }
    }

    // Move current file to .1
    const rotatedFile = path.join(dir, `${basename}.1${ext}`);
    if (fs.existsSync(logFile)) {
      fs.renameSync(logFile, rotatedFile);
    }
  }

  private shouldLog(level: LogLevel): boolean {
    return level <= this.logLevel;
  }

  error(message: string, meta?: any): void {
    if (this.shouldLog(LogLevel.ERROR)) {
      const logEntry = this.formatLogEntry('ERROR', message, meta);
      console.error('❌', JSON.stringify(logEntry));
      this.writeToFile('error.log', logEntry);
      this.writeToFile('combined.log', logEntry);
    }
  }

  warn(message: string, meta?: any): void {
    if (this.shouldLog(LogLevel.WARN)) {
      const logEntry = this.formatLogEntry('WARN', message, meta);
      console.warn('⚠️', JSON.stringify(logEntry));
      this.writeToFile('combined.log', logEntry);
    }
  }

  info(message: string, meta?: any): void {
    if (this.shouldLog(LogLevel.INFO)) {
      const logEntry = this.formatLogEntry('INFO', message, meta);
      console.log('ℹ️', JSON.stringify(logEntry));
      this.writeToFile('combined.log', logEntry);
    }
  }

  debug(message: string, meta?: any): void {
    if (this.shouldLog(LogLevel.DEBUG)) {
      const logEntry = this.formatLogEntry('DEBUG', message, meta);
      console.log('🐛', JSON.stringify(logEntry));
      this.writeToFile('debug.log', logEntry);
      this.writeToFile('combined.log', logEntry);
    }
  }

  // HTTP request logging
  logRequest(req: any, res: any, responseTime: number): void {
    const logEntry: LogEntry = {
      timestamp: new Date().toISOString(),
      level: 'INFO',
      message: 'HTTP Request',
      requestId: req.requestId,
      userId: req.user?.id,
      ip: req.ip || req.connection.remoteAddress,
      userAgent: req.get('User-Agent'),
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      responseTime
    };

    this.writeToFile('access.log', logEntry);
    
    // Log errors separately
    if (res.statusCode >= 400) {
      this.writeToFile('error.log', logEntry);
    }
  }

  // Database operation logging
  logDatabaseOperation(operation: string, table: string, duration: number, success: boolean, error?: Error): void {
    const logEntry = this.formatLogEntry(success ? 'INFO' : 'ERROR', 
      `Database ${operation} on ${table}`, 
      {
        operation,
        table,
        duration,
        success,
        error: error?.message
      }
    );

    this.writeToFile('database.log', logEntry);
    if (!success) {
      this.writeToFile('error.log', logEntry);
    }
  }

  // Security event logging
  logSecurityEvent(event: string, details: any): void {
    const logEntry = this.formatLogEntry('WARN', `Security Event: ${event}`, details);
    this.writeToFile('security.log', logEntry);
    this.writeToFile('combined.log', logEntry);
  }

  // Performance monitoring
  logPerformance(operation: string, duration: number, details?: any): void {
    const logEntry = this.formatLogEntry('INFO', `Performance: ${operation}`, {
      operation,
      duration,
      ...details
    });

    this.writeToFile('performance.log', logEntry);
    
    // Log slow operations as warnings
    if (duration > 1000) { // > 1 second
      this.warn(`Slow operation detected: ${operation} took ${duration}ms`, details);
    }
  }

  // API Performance logging
  logApiPerformance(method: string, path: string, statusCode: number, duration: number): void {
    const logEntry = this.formatLogEntry('INFO', 'API Performance', {
      method,
      path,
      statusCode,
      duration,
      isError: statusCode >= 400,
      isSlow: duration > 500
    });

    this.writeToFile('api-performance.log', logEntry);

    if (statusCode >= 400) {
      this.error(`API Error: ${method} ${path}`, { statusCode, duration });
    } else if (duration > 500) {
      this.warn(`Slow API Response: ${method} ${path}`, { duration });
    }
  }

  // Cache operation logging
  logCacheOperation(operation: string, key: string, hit: boolean, duration?: number): void {
    const logEntry = this.formatLogEntry('DEBUG', `Cache ${operation}`, {
      operation,
      key: key.substring(0, 50) + (key.length > 50 ? '...' : ''),
      hit,
      duration
    });

    this.writeToFile('cache.log', logEntry);

    if (duration && duration > 100) {
      this.warn(`Slow cache ${operation}`, { key, duration });
    }
  }

  // WebSocket event logging
  logWebSocketEvent(event: string, clientCount: number, data?: any): void {
    const logEntry = this.formatLogEntry('INFO', `WebSocket: ${event}`, {
      event,
      clientCount,
      ...data
    });

    this.writeToFile('websocket.log', logEntry);
  }

  // Error with context logging
  logError(message: string, error?: Error, context?: any): void {
    const meta = {
      ...context,
      error: error ? {
        message: error.message,
        stack: error.stack,
        name: error.name
      } : undefined
    };

    this.error(message, meta);
  }

  // Warning with context
  logWarning(message: string, context?: any): void {
    this.warn(message, context);
  }

  // Info with context
  logInfo(message: string, context?: any): void {
    this.info(message, context);
  }

  // Legacy methods for compatibility
  log = this.info;
}

export const logger = new Logger();
export default logger;