import { Router, type NextFunction, type Request, type Response } from 'express';
import { z } from 'zod';
import type { ProviderRegistry } from '../providers/registry.js';
import { runSync } from '../workers/syncWorker.js';

const authorizeSchema = z.object({
  state: z.string().min(16),
  codeChallenge: z.string().min(43),
  redirectUri: z.string().url(),
});

const syncSchema = z.object({
  accountId: z.string().min(1),
  providerAccountId: z.string().min(1),
  accessToken: z.string().min(1),
  grantedScopes: z.array(z.string()).default([]),
  cursor: z.record(z.unknown()).nullable().default(null),
  since: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  until: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

const tokenSchema = z.object({
  accessToken: z.string().min(1),
  refreshToken: z.string().nullable().optional(),
});

type Handler = (req: Request, res: Response) => Promise<void>;
const handle = (fn: Handler) => (req: Request, res: Response, next: NextFunction) => fn(req, res).catch(next);

/**
 * Java → Node contract (docs/architecture.md). Node is stateless here: tokens arrive per call from Java (which
 * stores them encrypted) and responses are normalized data. No product rules live in this service.
 */
export function internalRoutes(registry: ProviderRegistry): Router {
  const router = Router();

  router.get('/providers', (_req, res) => {
    res.json({ providers: registry.all().map((a) => a.status()) });
  });

  router.post('/providers/:provider/authorize-url', (req, res) => {
    const adapter = registry.get(req.params.provider ?? '');
    const body = authorizeSchema.parse(req.body);
    res.json({ authorizationUrl: adapter.authorizeUrl(body) });
  });

  router.post('/providers/:provider/sync', handle(async (req, res) => {
    const adapter = registry.get(req.params.provider ?? '');
    res.json(await runSync(adapter, syncSchema.parse(req.body), res.locals.correlationId));
  }));

  router.post('/providers/:provider/refresh', handle(async (req, res) => {
    const adapter = registry.get(req.params.provider ?? '');
    res.json(await adapter.refresh(tokenSchema.parse(req.body)));
  }));

  router.post('/providers/:provider/revoke', handle(async (req, res) => {
    const adapter = registry.get(req.params.provider ?? '');
    res.json(await adapter.revoke(tokenSchema.parse(req.body)));
  }));

  return router;
}
