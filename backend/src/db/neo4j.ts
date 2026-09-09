import neo4j, { Driver, Session } from 'neo4j-driver';
import { config } from '../config';
import { logger } from '../utils/logger';

let driver: Driver | null = null;
let isConnected = false;

/**
 * Initialize Neo4j driver connection with cloud compatibility (AuraDB, self-hosted, Docker).
 */
export async function initNeo4j(): Promise<void> {
  if (driver) return;

  try {
    if (config.NODE_ENV === 'test') {
      logger.info('Skipping Neo4j initialization in test environment.');
      return;
    }

    const isAura = config.NEO4J_URI.startsWith('neo4j+s://') || config.NEO4J_URI.startsWith('neo4j+ssc://');

    driver = neo4j.driver(
      config.NEO4J_URI,
      neo4j.auth.basic(config.NEO4J_USER, config.NEO4J_PASSWORD),
      {
        maxConnectionPoolSize: 50,
        connectionTimeout: 10000,
        maxConnectionLifetime: 3 * 60 * 60 * 1000, // 3 hours
        encrypted: isAura || config.NEO4J_ENCRYPTED ? 'ENCRYPTION_ON' : 'ENCRYPTION_OFF',
      }
    );

    // Verify connectivity
    const serverInfo = await driver.getServerInfo();
    isConnected = true;
    logger.info(`Connected to Neo4j database at ${config.NEO4J_URI} (Protocol: ${serverInfo.protocolVersion})`);
  } catch (err: any) {
    logger.warn(`Failed to connect to Neo4j at ${config.NEO4J_URI}: ${err.message}`);
    logger.warn('Graph features will fallback to in-memory mode.');
    driver = null;
    isConnected = false;
  }
}

/**
 * Close Neo4j driver connection.
 */
export async function closeNeo4j(): Promise<void> {
  if (driver) {
    await driver.close();
    driver = null;
    isConnected = false;
    logger.info('Neo4j connection closed.');
  }
}

/**
 * Execute a Cypher query on the Neo4j database with database routing.
 */
export async function runCypher(query: string, params: Record<string, any> = {}): Promise<any[]> {
  if (!driver || !isConnected) {
    throw new Error('Neo4j driver is not initialized or connected.');
  }

  const session: Session = driver.session({ database: config.NEO4J_DATABASE || 'neo4j' });
  try {
    const result = await session.run(query, params);
    return result.records;
  } finally {
    await session.close();
  }
}

export function isNeo4jConnected(): boolean {
  return isConnected;
}

/**
 * Healthcheck helper for Neo4j connection.
 */
export async function checkNeo4jConnection(): Promise<{ status: string; error?: string }> {
  if (config.NODE_ENV === 'test') {
    return { status: 'mocked_for_tests' };
  }

  if (!driver || !isConnected) {
    return { status: 'disconnected', error: 'Driver uninitialized or disconnected' };
  }
  try {
    await driver.getServerInfo();
    return { status: 'connected' };
  } catch (err: any) {
    return { status: 'error', error: err.message };
  }
}
