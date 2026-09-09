import { Request, Response } from 'express';
import { checkPostgresConnection } from '../db/postgres';
import { checkNeo4jConnection } from '../db/neo4j';
import { config } from '../config';
import { StorageService } from '../services/storage.service';

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

export async function getLiveness(_req: Request, res: Response): Promise<void> {
  res.status(200).json({
    status: 'alive',
    service: 'hypothesiai-backend',
    timestamp: new Date().toISOString(),
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
    let aiResp: globalThis.Response | null = null;
    const probeUrls = [
      `${config.AI_SERVICE_URL}/health`,
      'http://127.0.0.1:8000/health',
      `${config.AI_SERVICE_URL}/api/v1/health`,
      'http://127.0.0.1:8000/api/v1/health',
    ];
    for (const url of probeUrls) {
      try {
        const resp = await fetch(url, { signal: controller.signal });
        if (resp.ok) {
          aiResp = resp;
          break;
        }
      } catch {
        // try next
      }
    }
    clearTimeout(timeout);
    aiServiceStatus = aiResp && aiResp.ok ? 'connected' : 'disconnected';
  } catch (err) {
    aiServiceStatus = 'disconnected';
  }

  // Check storage accessibility
  let storageStatus = 'ok';
  try {
    const driver = StorageService.getDriver();
    storageStatus = driver ? 'ready' : 'degraded';
  } catch {
    storageStatus = 'degraded';
  }

  const isReady = pgCheck.status === 'connected';

  // Return HTTP 200 with complete diagnostics report so UI displays actual service states
  res.status(200).json({
    status: isReady ? 'ready' : 'degraded',
    checks: {
      postgres: pgCheck,
      neo4j: neo4jCheck,
      ai_service: { status: aiServiceStatus },
      storage: { status: storageStatus, driver: config.STORAGE_DRIVER },
    },
    timestamp: new Date().toISOString(),
  });
}
