import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import { logger } from '../config/logger.js';
import { IntegrationError } from '../shared/errors.js';

/** Maps failures to the error body the Java gateway client understands. Internals are logged, never returned. */
export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof IntegrationError) {
    res.status(err.httpStatus).json(err.toBody());
    return;
  }
  if (err instanceof ZodError) {
    res.status(400).json({
      code: 'INVALID_REQUEST',
      category: 'BAD_RESPONSE',
      message: err.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '),
      retryAfterSeconds: null,
    });
    return;
  }
  logger.error('unhandled error', { correlationId: res.locals.correlationId, error: err instanceof Error ? err.message : String(err) });
  res.status(500).json({ code: 'INTERNAL_ERROR', category: 'TRANSIENT', message: 'Unexpected integration error', retryAfterSeconds: null });
}
