import { Pool, PoolConfig } from 'pg';
import { config } from '../config';
import { logger } from '../utils/logger';

const poolConfig: PoolConfig = {
  connectionString: config.DATABASE_URL,
  max: config.DATABASE_MAX_CONNECTIONS || 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
  ssl: config.DATABASE_SSL
    ? { rejectUnauthorized: false }
    : undefined,
};

export const pgPool = new Pool(poolConfig);

pgPool.on('connect', () => {
  logger.debug('New client connected to PostgreSQL pool');
});

pgPool.on('error', (err) => {
  logger.error('Unexpected error on idle PostgreSQL client', err);
});

export async function checkPostgresConnection(): Promise<{ status: 'connected' | 'disconnected'; error?: string }> {
  try {
    const client = await pgPool.connect();
    await client.query('SELECT 1');
    client.release();
    return { status: 'connected' };
  } catch (err: any) {
    return { status: 'disconnected', error: err.message || 'Failed to connect to PostgreSQL' };
  }
}
