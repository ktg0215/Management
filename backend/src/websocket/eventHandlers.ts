import { Pool } from 'pg';
import { WebSocketManager } from './WebSocketServer';
import { logger } from '../utils/logger';

interface EventHandlerOptions {
  pool: Pool;
  wsManager: WebSocketManager;
}

export class RealTimeEventHandlers {
  private pool: Pool;
  private wsManager: WebSocketManager;

  constructor(options: EventHandlerOptions) {
    this.pool = options.pool;
    this.wsManager = options.wsManager;
  }

  // Handle sales data updates
  async handleSalesDataUpdate(
    storeId: string,
    year: number,
    month: number,
    dailyData: Record<string, any>,
    updatedBy: string
  ): Promise<void> {
    try {
      // Broadcast real-time update
      this.wsManager.broadcastSalesDataUpdate({
        storeId,
        year,
        month,
        dailyData,
        updatedBy,
        timestamp: Date.now()
      });

      // Send aggregated data to business type subscribers
      const storeInfo = await this.getStoreInfo(storeId);
      if (storeInfo) {
        this.wsManager.broadcastStoreUpdate(storeId, 'sales-updated', {
          storeId,
          storeName: storeInfo.name,
          businessType: storeInfo.business_type_name,
          year,
          month,
          totalSales: this.calculateTotalSales(dailyData),
          updateTime: new Date().toISOString()
        });
      }

      // Log activity
      await this.logSalesActivity(storeId, year, month, updatedBy, 'update');

    } catch (error) {
      logger.logError('Failed to handle sales data update event', error as Error, {
        storeId, year, month, updatedBy
      });
    }
  }

  // Handle sales data creation
  async handleSalesDataCreation(
    storeId: string,
    year: number,
    month: number,
    dailyData: Record<string, any>,
    createdBy: string
  ): Promise<void> {
    try {
      // Broadcast creation event
      this.wsManager.broadcastSalesDataUpdate({
        storeId,
        year,
        month,
        dailyData,
        updatedBy: createdBy,
        timestamp: Date.now()
      });

      // Send notification to store managers
      await this.notifyStoreManagers(storeId, {
        type: 'sales-data-created',
        message: `New sales data created for ${year}/${month}`,
        storeId,
        year,
        month,
        createdBy
      });

      // Log activity
      await this.logSalesActivity(storeId, year, month, createdBy, 'create');

    } catch (error) {
      logger.logError('Failed to handle sales data creation event', error as Error, {
        storeId, year, month, createdBy
      });
    }
  }

  // Handle batch sales data updates
  async handleBatchSalesDataUpdate(
    batchResults: Array<{
      storeId: string;
      year: number;
      month: number;
      status: 'created' | 'updated' | 'failed';
    }>,
    userId: string
  ): Promise<void> {
    try {
      const successfulUpdates = batchResults.filter(r => r.status !== 'failed');
      const failedUpdates = batchResults.filter(r => r.status === 'failed');

      // Group by store for efficient broadcasting
      const updatesByStore = new Map<string, typeof successfulUpdates>();
      
      for (const update of successfulUpdates) {
        if (!updatesByStore.has(update.storeId)) {
          updatesByStore.set(update.storeId, []);
        }
        updatesByStore.get(update.storeId)!.push(update);
      }

      // Broadcast updates per store
      for (const [storeId, updates] of updatesByStore) {
        this.wsManager.broadcastStoreUpdate(storeId, 'batch-sales-updated', {
          storeId,
          updates: updates.map(u => ({
            year: u.year,
            month: u.month,
            status: u.status
          })),
          totalUpdated: updates.length,
          timestamp: Date.now(),
          updatedBy: userId
        });
      }

      // Notify about failures if any
      if (failedUpdates.length > 0) {
        this.wsManager.broadcastSystemAnnouncement(
          `Batch sales data update completed with ${failedUpdates.length} failures`,
          {
            successful: successfulUpdates.length,
            failed: failedUpdates.length,
            updatedBy: userId
          }
        );
      }

    } catch (error) {
      logger.logError('Failed to handle batch sales data update event', error as Error, {
        batchCount: batchResults.length,
        userId
      });
    }
  }

  // Handle store status changes
  async handleStoreStatusChange(
    storeId: string,
    status: 'active' | 'inactive' | 'maintenance',
    changedBy: string
  ): Promise<void> {
    try {
      const storeInfo = await this.getStoreInfo(storeId);
      
      this.wsManager.broadcastStoreUpdate(storeId, 'status-changed', {
        storeId,
        storeName: storeInfo?.name,
        newStatus: status,
        changedBy,
        timestamp: Date.now()
      });

      // Notify all users of the affected store
      await this.notifyStoreUsers(storeId, {
        type: 'store-status-changed',
        message: `Store status changed to ${status}`,
        newStatus: status,
        timestamp: Date.now()
      });

    } catch (error) {
      logger.logError('Failed to handle store status change event', error as Error, {
        storeId, status, changedBy
      });
    }
  }

  // Handle user login events
  async handleUserLogin(userId: string, storeId: string, loginInfo: any): Promise<void> {
    try {
      // Send welcome notification to the user
      this.wsManager.broadcastUserNotification(userId, {
        type: 'login-welcome',
        message: 'Welcome back! You are now connected to real-time updates.',
        loginTime: new Date().toISOString(),
        storeId
      });

      // Notify store managers about user activity (if enabled)
      if (loginInfo.notifyManagers) {
        await this.notifyStoreManagers(storeId, {
          type: 'user-login',
          userId,
          loginTime: new Date().toISOString(),
          ipAddress: loginInfo.ipAddress
        });
      }

    } catch (error) {
      logger.logError('Failed to handle user login event', error as Error, {
        userId, storeId
      });
    }
  }

  // Handle system maintenance announcements
  async handleMaintenanceAnnouncement(
    message: string,
    maintenanceWindow: { start: string; end: string },
    affectedServices: string[]
  ): Promise<void> {
    try {
      this.wsManager.broadcastSystemAnnouncement(message, {
        type: 'maintenance-announcement',
        maintenanceWindow,
        affectedServices,
        severity: 'info'
      });

      logger.logInfo('Maintenance announcement broadcasted', {
        message,
        maintenanceWindow,
        affectedServices
      });

    } catch (error) {
      logger.logError('Failed to handle maintenance announcement', error as Error, {
        message, maintenanceWindow, affectedServices
      });
    }
  }

  // Handle data export completion
  async handleExportCompletion(
    userId: string,
    exportType: string,
    fileName: string,
    downloadUrl: string
  ): Promise<void> {
    try {
      this.wsManager.broadcastUserNotification(userId, {
        type: 'export-completed',
        message: `Your ${exportType} export is ready for download`,
        fileName,
        downloadUrl,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() // 24 hours
      });

    } catch (error) {
      logger.logError('Failed to handle export completion event', error as Error, {
        userId, exportType, fileName
      });
    }
  }

  // Helper methods
  private async getStoreInfo(storeId: string): Promise<any> {
    try {
      const result = await this.pool.query(`
        SELECT s.*, bt.name as business_type_name
        FROM stores s
        LEFT JOIN business_types bt ON s.business_type_id = bt.id
        WHERE s.id = $1
      `, [storeId]);

      return result.rows[0] || null;
    } catch (error) {
      logger.logError('Failed to get store info', error as Error, { storeId });
      return null;
    }
  }

  private calculateTotalSales(dailyData: Record<string, any>): number {
    let total = 0;
    
    for (const [day, data] of Object.entries(dailyData)) {
      if (data && typeof data === 'object' && 'sales' in data) {
        total += Number(data.sales) || 0;
      }
    }
    
    return total;
  }

  private async logSalesActivity(
    storeId: string,
    year: number,
    month: number,
    userId: string,
    actionType: string
  ): Promise<void> {
    try {
      const storeInfo = await this.getStoreInfo(storeId);
      
      await this.pool.query(`
        INSERT INTO activity_logs (
          user_id, store_id, business_type_id, action_type, 
          resource_type, resource_name, description
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      `, [
        userId,
        storeId,
        storeInfo?.business_type_id,
        actionType,
        'sales_data',
        `${year}/${month}`,
        `Sales data ${actionType} for ${storeInfo?.name || storeId} - ${year}/${month}`
      ]);

    } catch (error) {
      logger.logError('Failed to log sales activity', error as Error, {
        storeId, year, month, userId, actionType
      });
    }
  }

  private async notifyStoreManagers(storeId: string, notification: any): Promise<void> {
    try {
      const managers = await this.pool.query(`
        SELECT id FROM employees 
        WHERE store_id = $1 AND role IN ('admin', 'super_admin') AND is_active = true
      `, [storeId]);

      for (const manager of managers.rows) {
        this.wsManager.broadcastUserNotification(manager.id, notification);
      }

    } catch (error) {
      logger.logError('Failed to notify store managers', error as Error, {
        storeId, notification
      });
    }
  }

  private async notifyStoreUsers(storeId: string, notification: any): Promise<void> {
    try {
      const users = await this.pool.query(`
        SELECT id FROM employees 
        WHERE store_id = $1 AND is_active = true
      `, [storeId]);

      for (const user of users.rows) {
        this.wsManager.broadcastUserNotification(user.id, notification);
      }

    } catch (error) {
      logger.logError('Failed to notify store users', error as Error, {
        storeId, notification
      });
    }
  }

  // Performance monitoring
  public getEventHandlerStats(): any {
    return {
      handlerStatus: 'active',
      lastEventProcessed: new Date().toISOString(),
      processingQueue: 0 // Could be expanded with actual queue implementation
    };
  }
}