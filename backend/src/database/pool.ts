import { Pool, PoolConfig } from 'pg';

const poolConfig: PoolConfig = {
  connectionString: process.env.DATABASE_URL?.trim(),
  // Connection pool optimization
  max: parseInt(process.env.DB_POOL_MAX || '20'), // Maximum connections
  min: parseInt(process.env.DB_POOL_MIN || '5'),  // Minimum connections
  idleTimeoutMillis: parseInt(process.env.DB_IDLE_TIMEOUT || '30000'), // 30s
  connectionTimeoutMillis: parseInt(process.env.DB_CONNECTION_TIMEOUT || '10000'), // 10s
  acquireTimeoutMillis: parseInt(process.env.DB_ACQUIRE_TIMEOUT || '60000'), // 60s
  maxUses: parseInt(process.env.DB_MAX_USES || '7500'), // Max uses per connection
  
  // Performance tuning
  keepAlive: true,
  keepAliveInitialDelayMillis: 10000,
  
  // Error handling
  allowExitOnIdle: process.env.NODE_ENV !== 'production',
};

let pool: Pool | null = null;

export const createDatabasePool = (): Pool => {
  if (pool) {
    return pool;
  }

  pool = new Pool(poolConfig);

  // Connection event handlers
  pool.on('connect', (client) => {
    console.log('✅ New database connection established');
  });

  pool.on('acquire', (client) => {
    console.log('🔄 Connection acquired from pool');
  });

  pool.on('error', (err, client) => {
    console.error('❌ Database connection error:', err.message);
  });

  pool.on('remove', (client) => {
    console.log('🗑️ Connection removed from pool');
  });

  return pool;
};

export const getDatabasePool = (): Pool | null => {
  return pool;
};

export const closeDatabasePool = async (): Promise<void> => {
  if (pool) {
    await pool.end();
    pool = null;
    console.log('🔒 Database pool closed');
  }
};

// Health check for database connections
export const checkDatabaseHealth = async (): Promise<boolean> => {
  if (!pool) {
    return false;
  }

  try {
    const client = await pool.connect();
    await client.query('SELECT 1');
    client.release();
    return true;
  } catch (error) {
    console.error('Database health check failed:', error);
    return false;
  }
};