import { Request, Response, NextFunction } from 'express';
import logger from '../utils/logger';

export interface AppError extends Error {
  statusCode?: number;
  code?: string;
  detail?: string;
  hint?: string;
}

export class ApiError extends Error implements AppError {
  statusCode: number;
  code?: string;
  detail?: string;
  hint?: string;

  constructor(message: string, statusCode = 500, code?: string) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.code = code;
    Error.captureStackTrace(this, this.constructor);
  }
}

export function errorHandler(
  err: AppError,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  const statusCode = err.statusCode || 500;
  const rawMessage = err.message || 'Internal Server Error';
  const isProduction = process.env.NODE_ENV === 'production';
  const message = isProduction && statusCode >= 500 ? 'Internal Server Error' : rawMessage;

  logger.error('Request error', {
    path: req.path,
    method: req.method,
    statusCode,
    message: rawMessage,
    code: err.code,
    detail: err.detail,
    stack: err.stack,
  });

  res.status(statusCode).json({
    success: false,
    error: message,
    code: err.code,
    detail: isProduction && statusCode >= 500 ? undefined : err.detail,
    hint: err.hint,
  });
}

export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json({
    success: false,
    error: `Route ${req.method} ${req.path} not found`,
  });
}

export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<void>
) {
  return (req: Request, res: Response, next: NextFunction): void => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
