import { timingSafeEqual } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';

/**
 * Guards /internal/** — only the Java backend may call these routes (service-to-service shared secret, compared in
 * constant time). This is not Bloom app authentication. The public proxy never routes /internal.
 */
export function internalAuth(expectedToken: string) {
  const expected = Buffer.from(expectedToken);
  return (req: Request, res: Response, next: NextFunction) => {
    const given = Buffer.from(req.header('x-internal-token') ?? '');
    const ok = expected.length > 0 && given.length === expected.length && timingSafeEqual(given, expected);
    if (!ok) {
      res.status(401).json({ code: 'INTERNAL_AUTH_FAILED', category: 'PERMISSION', message: 'Invalid internal token', retryAfterSeconds: null });
      return;
    }
    next();
  };
}
