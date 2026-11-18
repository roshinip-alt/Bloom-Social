import type { NextFunction, Request, Response } from 'express';
import { logger } from '../config/logger.js';

/** Logs method, path and status only. Query strings are never logged: OAuth callbacks carry codes and state. */
export function requestLogger(req: Request, res: Response, next: NextFunction) {
  const started = Date.now();
  res.on('finish', () => {
    logger.info('request', {
      method: req.method,
      path: req.baseUrl + req.path,
      status: res.statusCode,
      ms: Date.now() - started,
      correlationId: res.locals.correlationId,
    });
  });
  next();
}
