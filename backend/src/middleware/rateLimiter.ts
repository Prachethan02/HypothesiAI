/**
 * Production Rate Limiter Middleware — Stage 20
 * ===============================================
 * Sliding-window rate limiter protecting backend API endpoints.
 * Exempts internal healthchecks and probes.
 */
import { Request, Response, NextFunction } from 'express';
import { config } from '../config';
import { logger } from '../utils/logger';

interface ClientHitRecord {
  timestamps: number[];
}

const clientHits = new Map<string, ClientHitRecord>();

// Periodic garbage collection for expired entries (every 2 minutes)
setInterval(() => {
  const now = Date.now();
  const windowMs = config.RATE_LIMIT_WINDOW_MS;
  for (const [ip, record] of clientHits.entries()) {
    record.timestamps = record.timestamps.filter((ts) => now - ts < windowMs);
    if (record.timestamps.length === 0) {
      clientHits.delete(ip);
    }
  }
}, 120_000);

function getClientIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') {
    return forwarded.split(',')[0].trim();
  }
  return req.socket.remoteAddress || req.ip || 'unknown';
}

export function rateLimiter(
  options: {
    windowMs?: number;
    maxRequests?: number;
    exemptPaths?: string[];
  } = {}
) {
  const windowMs = options.windowMs || config.RATE_LIMIT_WINDOW_MS;
  const maxRequests = options.maxRequests || config.RATE_LIMIT_MAX_REQUESTS;
  const exemptPaths = options.exemptPaths || ['/health', '/health/ready', '/health/live'];

  return (req: Request, res: Response, next: NextFunction): void => {
    // Skip rate limiting in test environment or for health probes
    if (config.NODE_ENV === 'test') {
      return next();
    }

    const pathToCheck = req.path.toLowerCase();
    if (exemptPaths.some((p) => pathToCheck.includes(p))) {
      return next();
    }

    const ip = getClientIp(req);
    const now = Date.now();

    let record = clientHits.get(ip);
    if (!record) {
      record = { timestamps: [] };
      clientHits.set(ip, record);
    }

    // Keep only timestamps within the active sliding window
    record.timestamps = record.timestamps.filter((ts) => now - ts < windowMs);

    const currentCount = record.timestamps.length;
    const remaining = Math.max(0, maxRequests - currentCount - 1);
    const oldestTimestamp = record.timestamps[0] || now;
    const resetSec = Math.ceil((oldestTimestamp + windowMs - now) / 1000);

    // Standard IETF RateLimit headers
    res.setHeader('RateLimit-Limit', maxRequests);
    res.setHeader('RateLimit-Remaining', remaining);
    res.setHeader('RateLimit-Reset', resetSec);

    if (currentCount >= maxRequests) {
      logger.warn(`Rate limit exceeded for IP ${ip}: ${currentCount}/${maxRequests} reqs in ${windowMs}ms`);
      res.setHeader('Retry-After', resetSec);
      res.status(429).json({
        success: false,
        error: {
          message: 'Too many requests. Please slow down and try again later.',
          statusCode: 429,
          retryAfterSeconds: resetSec,
        },
      });
      return;
    }

    record.timestamps.push(now);
    next();
  };
}

/**
 * Strict rate limiter for authentication routes (login / register)
 * to prevent brute-force and credential stuffing attacks.
 * Defaults to 20 attempts per 5 minutes.
 */
export function authRateLimiter() {
  if (config.NODE_ENV === 'development' || config.NODE_ENV === 'test') {
    return (_req: any, _res: any, next: any) => next();
  }
  return rateLimiter({
    windowMs: 5 * 60 * 1000, // 5 minutes
    maxRequests: 50,
  });
}

