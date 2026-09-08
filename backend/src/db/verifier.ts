import { pgPool, checkPostgresConnection } from './postgres';
import { ALL_TABLE_NAMES } from './types';
import { logger } from '../utils/logger';

export interface SchemaVerificationResult {
  connected: boolean;
  totalTablesExpected: number;
  tablesFoundCount: number;
  missingTables: string[];
  tablesFound: string[];
  foreignKeysCount: number;
  indexesCount: number;
  status: 'valid' | 'incomplete' | 'disconnected';
}

export async function verifyDatabaseSchema(): Promise<SchemaVerificationResult> {
  const connCheck = await checkPostgresConnection();
  if (connCheck.status !== 'connected') {
    return {
      connected: false,
      totalTablesExpected: ALL_TABLE_NAMES.length,
      tablesFoundCount: 0,
      missingTables: [...ALL_TABLE_NAMES],
      tablesFound: [],
      foreignKeysCount: 0,
      indexesCount: 0,
      status: 'disconnected',
    };
  }

  const client = await pgPool.connect();
  try {
    // 1. Fetch tables in public schema
    const tablesRes = await client.query<{ table_name: string }>(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    `);
    const existingTableNames = tablesRes.rows.map((r) => r.table_name);

    const found = ALL_TABLE_NAMES.filter((t) => existingTableNames.includes(t));
    const missing = ALL_TABLE_NAMES.filter((t) => !existingTableNames.includes(t));

    // 2. Count foreign keys
    const fkRes = await client.query<{ count: string }>(`
      SELECT count(*) as count
      FROM information_schema.table_constraints
      WHERE constraint_type = 'FOREIGN KEY' AND table_schema = 'public'
    `);
    const fkCount = parseInt(fkRes.rows[0]?.count || '0', 10);

    // 3. Count indexes
    const idxRes = await client.query<{ count: string }>(`
      SELECT count(*) as count
      FROM pg_indexes
      WHERE schemaname = 'public'
    `);
    const idxCount = parseInt(idxRes.rows[0]?.count || '0', 10);

    const isValid = missing.length === 0;

    return {
      connected: true,
      totalTablesExpected: ALL_TABLE_NAMES.length,
      tablesFoundCount: found.length,
      missingTables: missing,
      tablesFound: found,
      foreignKeysCount: fkCount,
      indexesCount: idxCount,
      status: isValid ? 'valid' : 'incomplete',
    };
  } finally {
    client.release();
  }
}

// Direct CLI Execution
if (require.main === module) {
  verifyDatabaseSchema()
    .then((res) => {
      if (res.status === 'disconnected') {
        logger.warn('⚠️  PostgreSQL is not reachable. Ensure Docker container or Supabase is running.');
        process.exit(1);
      } else if (res.status === 'incomplete') {
        logger.warn(`⚠️  Database schema incomplete. Missing tables (${res.missingTables.length}): ${res.missingTables.join(', ')}`);
        logger.info('Run `npm run db:migrate` to create all missing tables.');
        process.exit(1);
      } else {
        logger.info(`✅ Schema verification passed! All ${res.tablesFoundCount}/${res.totalTablesExpected} tables verified with ${res.foreignKeysCount} foreign keys and ${res.indexesCount} indexes.`);
        process.exit(0);
      }
    })
    .catch((err) => {
      logger.error('Schema verification encountered an error', err);
      process.exit(1);
    });
}
