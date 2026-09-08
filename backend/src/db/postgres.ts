import { Pool } from 'pg';
import { config } from '../config';
import { logger } from '../utils/logger';

export const pgPool = new Pool({
  connectionString: config.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
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
