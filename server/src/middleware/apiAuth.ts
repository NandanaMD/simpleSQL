import { Request, Response, NextFunction } from 'express';
import { timingSafeEqual } from 'crypto';

const API_TOKEN_HEADER = 'x-sqlide-token';

export function apiAuthMiddleware(req: Request, res: Response, next: NextFunction): void {
  const expectedToken = process.env.API_AUTH_TOKEN;

  if (!expectedToken) {
    if (process.env.NODE_ENV === 'production') {
      res.status(503).json({
        success: false,
        error: 'API authentication is not configured',
      });
      return;
    }
    next();
    return;
  }

  const providedToken = req.header(API_TOKEN_HEADER);
  if (!providedToken) {
    res.status(401).json({
      success: false,
      error: 'Unauthorized request',
    });
    return;
  }

  const expectedBuffer = Buffer.from(expectedToken, 'utf8');
  const providedBuffer = Buffer.from(providedToken, 'utf8');

  if (expectedBuffer.length !== providedBuffer.length || !timingSafeEqual(expectedBuffer, providedBuffer)) {
    res.status(401).json({
      success: false,
      error: 'Unauthorized request',
    });
    return;
  }

  next();
}
