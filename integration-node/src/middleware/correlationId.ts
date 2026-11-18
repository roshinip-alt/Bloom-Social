import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';

const SAFE = /^[A-Za-z0-9._-]{8,64}$/;

/** Propagates X-Correlation-Id from Java (or creates one) so a request can be traced across services. */
export function correlationId(req: Request, res: Response, next: NextFunction) {
  const incoming = req.header('x-correlation-id');
  const id = incoming && SAFE.test(incoming) ? incoming : randomUUID();
  res.locals.correlationId = id;
  res.setHeader('X-Correlation-Id', id);
  next();
}
