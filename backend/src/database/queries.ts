import { Pool } from 'pg';

export class QueryService {
  private pool: Pool;

  constructor(pool: Pool) {
    this.pool = pool;
  }

  // Optimized employee queries with prepared statements
  async findEmployeeById(id: string) {
    const query = `
      SELECT e.id, e.employee_id, e.full_name, e.nickname, e.store_id, e.role, e.is_active,
             s.name as store_name, s.business_type_id
      FROM employees e
      LEFT JOIN stores s ON e.store_id = s.id
      WHERE e.id = $1 AND e.is_active = true
    `;
    return this.pool.query(query, [id]);
  }

  async findEmployeeByEmployeeId(employeeId: string) {
    const query = `
      SELECT e.id, e.employee_id, e.full_name, e.nickname, e.store_id, 
             e.password_hash, e.role, e.is_active,
             s.name as store_name, s.business_type_id
      FROM employees e
      LEFT JOIN stores s ON e.store_id = s.id
      WHERE e.employee_id = $1 AND e.is_active = true
      LIMIT 1
    `;
    return this.pool.query(query, [employeeId]);
  }

  // Optimized store queries with business type info
  async getStoresWithBusinessTypes() {
    const query = `
      SELECT s.id, s.name, s.business_type_id, s.created_at, s.updated_at,
             bt.name as business_type_name, bt.description as business_type_description
      FROM stores s
      LEFT JOIN business_types bt ON s.business_type_id = bt.id
      ORDER BY s.name
    `;
    return this.pool.query(query);
  }

  // Optimized activity logs with pagination
  async getActivityLogs(userRole: string, storeId?: string, limit: number = 50, offset: number = 0) {
    let query = `
      SELECT al.id, al.action_type, al.resource_type, al.resource_name, 
             al.description, al.created_at,
             e.full_name as user_name, s.name as store_name, bt.name as business_type_name
      FROM activity_logs al
      LEFT JOIN employees e ON al.user_id = e.id
      LEFT JOIN stores s ON al.store_id = s.id
      LEFT JOIN business_types bt ON al.business_type_id = bt.id
    `;
    const params: any[] = [];

    if (userRole === 'user') {
      // Return empty result for regular users
      return { rows: [], rowCount: 0 };
    } else if (userRole === 'admin' && storeId) {
      query += `
        WHERE al.business_type_id = (
          SELECT bt.id FROM business_types bt
          JOIN stores s ON bt.id = s.business_type_id
          WHERE s.id = $1
        )
      `;
      params.push(storeId);
    }

    query += ` ORDER BY al.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);

    return this.pool.query(query, params);
  }

  // Optimized sales data query
  async getSalesData(year: number, month: number, storeId: string) {
    const query = `
      SELECT sd.*, s.name as store_name
      FROM sales_data sd
      JOIN stores s ON sd.store_id = s.id
      WHERE sd.year = $1 AND sd.month = $2 AND sd.store_id = $3
      LIMIT 1
    `;
    return this.pool.query(query, [year, month, storeId]);
  }

  // Optimized payment data with company info
  async getPaymentsWithCompanyInfo(month?: string, storeId?: string, limit: number = 100, offset: number = 0) {
    let query = `
      SELECT p.id, p.company_id, p.month, p.amount, p.store_id, p.created_at, p.updated_at,
             c.name as company_name, c.category as company_category,
             s.name as store_name
      FROM payments p
      JOIN companies c ON p.company_id = c.id
      JOIN stores s ON c.store_id = s.id
    `;
    const params: any[] = [];
    const conditions: string[] = [];

    if (month) {
      conditions.push(`p.month = $${params.length + 1}`);
      params.push(month);
    }

    if (storeId) {
      conditions.push(`c.store_id = $${params.length + 1}`);
      params.push(storeId);
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    query += ` ORDER BY p.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);

    return this.pool.query(query, params);
  }

  // Batch operations for bulk inserts/updates
  async bulkUpsertPayments(payments: any[]) {
    const client = await this.pool.connect();
    
    try {
      await client.query('BEGIN');

      for (const payment of payments) {
        const upsertQuery = `
          INSERT INTO payments (id, company_id, month, amount, store_id, created_at, updated_at)
          VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
          ON CONFLICT (id) 
          DO UPDATE SET amount = EXCLUDED.amount, updated_at = NOW()
        `;
        await client.query(upsertQuery, [
          payment.id, payment.companyId, payment.month, payment.amount, payment.storeId
        ]);
      }

      await client.query('COMMIT');
      return { success: true, processedCount: payments.length };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
}