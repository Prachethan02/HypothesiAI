import fs from 'fs';
import path from 'path';
import { pgPool } from './postgres';
import { logger } from '../utils/logger';

export interface MigrationRecord {
  id: number;
  migration_name: string;
  applied_at: Date;
  duration_ms: number;
}

export async function ensureMigrationTable(): Promise<void> {
  const query = `
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id SERIAL PRIMARY KEY,
      migration_name VARCHAR(255) UNIQUE NOT NULL,
      applied_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      duration_ms INT NOT NULL
    );
  `;
  await pgPool.query(query);
}

export function getMigrationFiles(): { name: string; fullPath: string }[] {
  // Check both relative backend and root database directories
  const candidateDirs = [
    path.resolve(process.cwd(), '../database/migrations'),
    path.resolve(process.cwd(), 'database/migrations'),
    path.resolve(__dirname, '../../../database/migrations'),
  ];

  const migrationsDir = candidateDirs.find((d) => fs.existsSync(d));
  if (!migrationsDir) {
    throw new Error(`Migrations directory not found in candidate paths: ${candidateDirs.join(', ')}`);
  }

  const files = fs
    .readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  return files.map((f) => ({
    name: f,
    fullPath: path.join(migrationsDir, f),
  }));
}

export async function getAppliedMigrations(): Promise<string[]> {
  await ensureMigrationTable();
  const res = await pgPool.query<{ migration_name: string }>(
    'SELECT migration_name FROM schema_migrations ORDER BY id ASC'
  );
  return res.rows.map((r) => r.migration_name);
}

export async function runMigrations(): Promise<{ applied: string[]; skipped: string[] }> {
  const client = await pgPool.connect();
  const applied: string[] = [];
  const skipped: string[] = [];

  try {
    await ensureMigrationTable();
    const appliedList = await getAppliedMigrations();
    const files = getMigrationFiles();

    for (const file of files) {
      if (appliedList.includes(file.name)) {
        logger.info(`⏩ Skipping already applied migration: ${file.name}`);
        skipped.push(file.name);
        continue;
      }

      logger.info(`🔄 Applying migration: ${file.name}...`);
      const sqlContent = fs.readFileSync(file.fullPath, 'utf8');

      const startTime = Date.now();
      await client.query('BEGIN');
      try {
        await client.query(sqlContent);
        const duration = Date.now() - startTime;

        await client.query(
          'INSERT INTO schema_migrations (migration_name, duration_ms) VALUES ($1, $2)',
          [file.name, duration]
        );

        await client.query('COMMIT');
        logger.info(`✅ Successfully applied: ${file.name} in ${duration}ms`);
        applied.push(file.name);
      } catch (err) {
        await client.query('ROLLBACK');
        logger.error(`❌ Migration failed: ${file.name}`, err);
        throw err;
      }
    }

    return { applied, skipped };
  } finally {
    client.release();
  }
}

// Direct CLI Execution
if (require.main === module) {
  runMigrations()
    .then((result) => {
      logger.info(`🏁 Migration execution complete. Applied: ${result.applied.length}, Skipped: ${result.skipped.length}`);
      process.exit(0);
    })
    .catch((err) => {
      logger.error('Migration runner failed', err);
      process.exit(1);
    });
}
