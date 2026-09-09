import express, { Application, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { config } from './config';
import { apiV1Router } from './routes';
import { errorHandler } from './middleware/errorHandler';
import { rateLimiter } from './middleware/rateLimiter';

export function createApp(): Application {
  const app = express();

  // Trust first proxy hop (Nginx, AWS ALB, Cloudflare) for accurate client IP resolution
  app.set('trust proxy', 1);

  // Security headers with production cross-origin allowances for PDF streaming
  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: 'cross-origin' },
      contentSecurityPolicy: config.NODE_ENV === 'production' ? undefined : false,
    })
  );

  // Dynamic CORS origin configuration
  const allowedOrigins = config.CORS_ORIGIN.split(',').map((o) => o.trim());
  app.use(
    cors({
      origin: (origin, callback) => {
        // Allow requests with no origin (mobile apps, curl, server-to-server)
        if (!origin) return callback(null, true);
        if (allowedOrigins.includes(origin)) {
          return callback(null, true);
        }
        if (config.NODE_ENV !== 'production' && allowedOrigins.includes('*')) {
          return callback(null, true);
        }
        return callback(null, false);
      },
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID'],
      exposedHeaders: ['RateLimit-Limit', 'RateLimit-Remaining', 'RateLimit-Reset', 'Retry-After'],
    })
  );

  // Request correlation ID tracking
  app.use((req: Request, res: Response, next: NextFunction) => {
    const requestId = (req.headers['x-request-id'] as string) || uuidv4();
    req.headers['x-request-id'] = requestId;
    res.setHeader('X-Request-ID', requestId);
    next();
  });

  // Global rate limiter
  app.use(rateLimiter());

  // Request parsing with sensible upload limits
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // Serve uploaded files statically (PDFs accessible at /uploads/papers/...)
  app.use(
    '/uploads',
    express.static(path.resolve(process.cwd(), 'uploads'), {
      dotfiles: 'deny',
      index: false,
      maxAge: config.NODE_ENV === 'production' ? '1d' : '0',
    })
  );

  // HTTP request logging
  if (config.NODE_ENV !== 'test') {
    app.use(morgan(config.NODE_ENV === 'production' ? 'combined' : 'dev'));
  }

  // Root health probe for cloud load balancers and orchestrators
  app.get('/health', (_req, res) => {
    res.json({
      status: 'ok',
      service: 'hypothesiai-backend',
      environment: config.NODE_ENV,
      timestamp: new Date().toISOString(),
    });
  });

  // Mount API v1
  app.use(config.API_PREFIX, apiV1Router);

  // 404 handler for unknown routes
  app.use((req, res) => {
    res.status(404).json({
      success: false,
      error: {
        message: `Route ${req.method} ${req.originalUrl} not found`,
        statusCode: 404,
      },
    });
  });

  // Centralized error handler
  app.use(errorHandler);

  return app;
}
