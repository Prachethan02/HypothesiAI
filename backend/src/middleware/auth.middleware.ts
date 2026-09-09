import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config';

export interface AuthUser {
  id: string;
  email: string;
  role: string;
  full_name?: string | null;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;

  const rejectUnauthenticated = (statusCode: number, message: string) => {
    let sent = false;
    const sendResponse = () => {
      if (!sent) {
        sent = true;
        res.status(statusCode).json({
          success: false,
          error: { message, statusCode },
        });
      }
    };

    if (req.complete || !req.readable) {
      sendResponse();
    } else {
      req.on('data', () => {});
      req.on('end', sendResponse);
      req.on('error', sendResponse);
      req.resume();
      setTimeout(sendResponse, 100);
    }
  };

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    rejectUnauthenticated(401, 'Authentication required. Missing Bearer token.');
    return;
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, config.JWT_SECRET) as AuthUser;
    req.user = {
      id: decoded.id,
      email: decoded.email,
      role: decoded.role || 'researcher',
      full_name: decoded.full_name,
    };
    next();
  } catch (err: any) {
    rejectUnauthenticated(401, 'Invalid or expired authentication token.');
  }
}
