import { Request, Response } from 'express';
import { checkPostgresConnection } from '../db/postgres';
import { checkNeo4jConnection } from '../db/neo4j';
import { config } from '../config';

export async function getHealth(_req: Request, res: Response): Promise<void> {
  res.status(200).json({
    status: 'ok',
    service: 'hypothesiai-backend',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: config.NODE_ENV,
  });
}

export async function getReadiness(_req: Request, res: Response): Promise<void> {
  const [pgCheck, neo4jCheck] = await Promise.all([
    checkPostgresConnection(),
    checkNeo4jConnection(),
  ]);

  let aiServiceStatus = 'unknown';
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);
    const aiResp = await fetch(`${config.AI_SERVICE_URL}/api/v1/health`, {
      signal: controller.signal,
    });
    clearTimeout(timeout);
    aiServiceStatus = aiResp.ok ? 'connected' : 'unhealthy';
  } catch (err) {
    aiServiceStatus = 'disconnected';
  }

  const isReady = pgCheck.status === 'connected';

  res.status(isReady ? 200 : 503).json({
    status: isReady ? 'ready' : 'degraded',
    checks: {
      postgres: pgCheck,
      neo4j: neo4jCheck,
      ai_service: { status: aiServiceStatus },
    },
    timestamp: new Date().toISOString(),
  });
}
