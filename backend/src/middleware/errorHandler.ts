import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';
import { config } from '../config';

export interface AppError extends Error {
  statusCode?: number;
  details?: any;
}

export function errorHandler(
  err: AppError,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  const statusCode = err.statusCode || 500;
  const rawMessage = err.message || 'Internal Server Error';

  logger.error(`[${req.method}] ${req.originalUrl} >> StatusCode: ${statusCode}, Message: ${rawMessage}`, {
    stack: err.stack,
    details: err.details,
  });

  // Protect internal error details from leaking to clients in production
  const clientMessage =
    config.NODE_ENV === 'production' && statusCode === 500
      ? 'An unexpected internal server error occurred. Please contact system support.'
      : rawMessage;

  res.status(statusCode).json({
    success: false,
    error: {
      message: clientMessage,
      statusCode,
      ...(config.NODE_ENV === 'development' && {
        stack: err.stack,
        details: err.details,
      }),
    },
  });
}
