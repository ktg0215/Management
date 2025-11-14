import WebSocket, { WebSocketServer } from 'ws';
import { Server } from 'http';
import jwt from 'jsonwebtoken';
import { logger } from '../utils/logger';
import { Pool } from 'pg';
import { IncomingMessage } from 'http';

interface AuthenticatedWebSocket extends WebSocket {
  user?: {
    id: string;
    employeeId: string;
    role: string;
    storeId: string;
  };
  subscriptions?: Set<string>;
  lastHeartbeat?: number;
}

interface AuthenticatedRequest extends IncomingMessage {
  user?: {
    id: string;
    employeeId: string;
    role: string;
    storeId: string;
  };
}

interface WebSocketMessage {
  type: 'subscribe' | 'unsubscribe' | 'ping' | 'pong' | 'data';
  event?: string;
  data?: any;
  clientId?: string;
  timestamp?: number;
}

interface SalesDataUpdate {
  storeId: string;
  year: number;
  month: number;
  dailyData: Record<string, any>;
  updatedBy: string;
  timestamp: number;
}

export class WebSocketManager {
  private wss: WebSocketServer;
  private clients: Map<string, AuthenticatedWebSocket> = new Map();
  private subscriptions: Map<string, Set<string>> = new Map();
  private pool: Pool;
  private heartbeatInterval: NodeJS.Timeout | null = null;

  constructor(server: Server, pool: Pool) {
    this.pool = pool;
    this.wss = new WebSocketServer({ 
      server,
      path: '/ws',
      verifyClient: this.verifyClient.bind(this)
    });

    this.setupWebSocketServer();
    this.startHeartbeat();

    logger.logInfo('WebSocket server initialized');
  }

  private verifyClient(info: { req: AuthenticatedRequest }): boolean {
    try {
      const token = this.extractTokenFromUrl(info.req.url || '');
      if (!token) return false;

      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'default-secret') as any;
      info.req.user = decoded;
      return true;
    } catch (error) {
      logger.logError('WebSocket authentication failed', error as Error);
      return false;
    }
  }

  private extractTokenFromUrl(url: string): string | null {
    const urlObj = new URL(url, 'http://localhost');
    return urlObj.searchParams.get('token');
  }

  private setupWebSocketServer(): void {
    this.wss.on('connection', (ws: AuthenticatedWebSocket, req: AuthenticatedRequest) => {
      const clientId = this.generateClientId();
      ws.user = req.user;
      ws.subscriptions = new Set();
      ws.lastHeartbeat = Date.now();

      this.clients.set(clientId, ws);

      logger.logInfo('WebSocket client connected', {
        clientId,
        userId: ws.user?.id,
        userRole: ws.user?.role
      });

      // Send welcome message
      this.sendToClient(ws, {
        type: 'data',
        event: 'connected',
        data: {
          clientId,
          serverTime: new Date().toISOString(),
          message: 'WebSocket connection established'
        }
      });

      // Handle incoming messages
      ws.on('message', (data) => {
        try {
          const message: WebSocketMessage = JSON.parse(data.toString());
          this.handleMessage(clientId, ws, message);
        } catch (error) {
          logger.logError('Invalid WebSocket message', error as Error, {
            clientId,
            data: data.toString()
          });
        }
      });

      // Handle client disconnect
      ws.on('close', () => {
        this.handleDisconnect(clientId);
      });

      // Handle errors
      ws.on('error', (error) => {
        logger.logError('WebSocket client error', error, { clientId });
        this.handleDisconnect(clientId);
      });
    });

    this.wss.on('error', (error) => {
      logger.logError('WebSocket server error', error);
    });
  }

  private handleMessage(clientId: string, ws: AuthenticatedWebSocket, message: WebSocketMessage): void {
    switch (message.type) {
      case 'subscribe':
        this.handleSubscribe(clientId, ws, message.event!);
        break;
        
      case 'unsubscribe':
        this.handleUnsubscribe(clientId, ws, message.event!);
        break;
        
      case 'ping':
        ws.lastHeartbeat = Date.now();
        this.sendToClient(ws, { type: 'pong', timestamp: Date.now() });
        break;
        
      default:
        logger.logWarning('Unknown WebSocket message type', {
          clientId,
          messageType: message.type
        });
    }
  }

  private handleSubscribe(clientId: string, ws: AuthenticatedWebSocket, event: string): void {
    if (!this.isValidSubscription(ws, event)) {
      this.sendToClient(ws, {
        type: 'data',
        event: 'error',
        data: { message: 'Subscription not allowed for this event' }
      });
      return;
    }

    ws.subscriptions!.add(event);

    if (!this.subscriptions.has(event)) {
      this.subscriptions.set(event, new Set());
    }
    this.subscriptions.get(event)!.add(clientId);

    logger.logInfo('Client subscribed to event', {
      clientId,
      event,
      userId: ws.user?.id
    });

    this.sendToClient(ws, {
      type: 'data',
      event: 'subscribed',
      data: { event, message: `Subscribed to ${event}` }
    });
  }

  private handleUnsubscribe(clientId: string, ws: AuthenticatedWebSocket, event: string): void {
    ws.subscriptions!.delete(event);

    if (this.subscriptions.has(event)) {
      this.subscriptions.get(event)!.delete(clientId);
      if (this.subscriptions.get(event)!.size === 0) {
        this.subscriptions.delete(event);
      }
    }

    logger.logInfo('Client unsubscribed from event', {
      clientId,
      event,
      userId: ws.user?.id
    });

    this.sendToClient(ws, {
      type: 'data',
      event: 'unsubscribed',
      data: { event, message: `Unsubscribed from ${event}` }
    });
  }

  private isValidSubscription(ws: AuthenticatedWebSocket, event: string): boolean {
    const user = ws.user!;
    
    // Global events (available to all authenticated users)
    const globalEvents = ['system-announcements', 'user-notifications'];
    if (globalEvents.includes(event)) return true;

    // Store-specific events
    if (event.startsWith(`store-${user.storeId}-`)) return true;

    // Sales data events - check permissions
    if (event.startsWith('sales-data-')) {
      const [, , storeId] = event.split('-');
      
      // Super admin can subscribe to any store
      if (user.role === 'super_admin') return true;
      
      // Admin can subscribe to their own store
      if (user.role === 'admin' && storeId === user.storeId) return true;
      
      // Users can subscribe to their own store
      if (user.role === 'user' && storeId === user.storeId) return true;
    }

    // Business type events for admins
    if (event.startsWith('business-type-') && ['admin', 'super_admin'].includes(user.role)) {
      return true;
    }

    return false;
  }

  private handleDisconnect(clientId: string): void {
    const ws = this.clients.get(clientId);
    if (ws) {
      // Remove from all subscriptions
      ws.subscriptions?.forEach(event => {
        if (this.subscriptions.has(event)) {
          this.subscriptions.get(event)!.delete(clientId);
          if (this.subscriptions.get(event)!.size === 0) {
            this.subscriptions.delete(event);
          }
        }
      });

      logger.logInfo('WebSocket client disconnected', {
        clientId,
        userId: ws.user?.id
      });
    }

    this.clients.delete(clientId);
  }

  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      const now = Date.now();
      const timeout = 30000; // 30 seconds

      for (const [clientId, ws] of this.clients.entries()) {
        if (now - (ws.lastHeartbeat || 0) > timeout) {
          logger.logWarning('WebSocket client heartbeat timeout', { clientId });
          ws.terminate();
          this.handleDisconnect(clientId);
        }
      }
    }, 10000); // Check every 10 seconds
  }

  private generateClientId(): string {
    return `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private sendToClient(ws: WebSocket, message: WebSocketMessage): void {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        ...message,
        timestamp: Date.now()
      }));
    }
  }

  // Public methods for broadcasting data
  public broadcastSalesDataUpdate(update: SalesDataUpdate): void {
    const event = `sales-data-${update.storeId}`;
    
    this.broadcast(event, {
      type: 'data',
      event: 'sales-data-updated',
      data: {
        storeId: update.storeId,
        year: update.year,
        month: update.month,
        dailyData: update.dailyData,
        updatedBy: update.updatedBy,
        timestamp: update.timestamp
      }
    });

    logger.logInfo('Sales data update broadcasted', {
      storeId: update.storeId,
      year: update.year,
      month: update.month,
      subscriberCount: this.subscriptions.get(event)?.size || 0
    });
  }

  public broadcastSystemAnnouncement(message: string, data?: any): void {
    this.broadcast('system-announcements', {
      type: 'data',
      event: 'system-announcement',
      data: { message, ...data }
    });

    logger.logInfo('System announcement broadcasted', {
      message,
      subscriberCount: this.subscriptions.get('system-announcements')?.size || 0
    });
  }

  public broadcastUserNotification(userId: string, notification: any): void {
    // Find clients for specific user
    for (const [clientId, ws] of this.clients.entries()) {
      if (ws.user?.id === userId && ws.subscriptions?.has('user-notifications')) {
        this.sendToClient(ws, {
          type: 'data',
          event: 'user-notification',
          data: notification
        });
      }
    }

    logger.logInfo('User notification sent', { userId, notification });
  }

  public broadcastStoreUpdate(storeId: string, updateType: string, data: any): void {
    const event = `store-${storeId}-updates`;
    
    this.broadcast(event, {
      type: 'data',
      event: `store-${updateType}`,
      data
    });

    logger.logInfo('Store update broadcasted', {
      storeId,
      updateType,
      subscriberCount: this.subscriptions.get(event)?.size || 0
    });
  }

  private broadcast(event: string, message: WebSocketMessage): void {
    const subscribers = this.subscriptions.get(event);
    
    if (!subscribers || subscribers.size === 0) return;

    for (const clientId of subscribers) {
      const ws = this.clients.get(clientId);
      if (ws) {
        this.sendToClient(ws, message);
      }
    }
  }

  public getConnectionStats(): any {
    const stats = {
      totalConnections: this.clients.size,
      totalSubscriptions: this.subscriptions.size,
      connectionsByRole: {} as Record<string, number>,
      subscriptionStats: {} as Record<string, number>
    };

    // Count connections by role
    for (const ws of this.clients.values()) {
      const role = ws.user?.role || 'unknown';
      stats.connectionsByRole[role] = (stats.connectionsByRole[role] || 0) + 1;
    }

    // Count subscriptions
    for (const [event, subscribers] of this.subscriptions.entries()) {
      stats.subscriptionStats[event] = subscribers.size;
    }

    return stats;
  }

  public shutdown(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }

    // Close all connections
    for (const ws of this.clients.values()) {
      ws.close(1001, 'Server shutting down');
    }

    this.wss.close();
    logger.logInfo('WebSocket server shutdown complete');
  }
}