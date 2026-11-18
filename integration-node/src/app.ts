import express, { type Express } from 'express';
import type { Env } from './config/env.js';
import { correlationId } from './middleware/correlationId.js';
import { errorHandler } from './middleware/errorHandler.js';
import { internalAuth } from './middleware/internalAuth.js';
import { requestLogger } from './middleware/requestLogger.js';
import type { ProviderRegistry } from './providers/registry.js';
import { healthRoutes } from './routes/health.js';
import { internalRoutes } from './routes/internal.js';
import { oauthCallbackRoutes } from './routes/oauthCallback.js';
import type { BloomApi } from './shared/bloomApi.js';
import { metaWebhookRoutes } from './webhooks/metaWebhooks.js';

export interface AppDeps {
  env: Env;
  registry: ProviderRegistry;
  bloom: BloomApi;
}

export function createApp({ env, registry, bloom }: AppDeps): Express {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1);
  app.use(correlationId);
  app.use(requestLogger);

  app.use(healthRoutes());
  app.use(oauthCallbackRoutes(registry, bloom, env.APP_PUBLIC_URL));
  app.use(metaWebhookRoutes(bloom, env.INSTAGRAM_APP_SECRET, env.APP_PUBLIC_URL));
  app.use('/internal/v1', internalAuth(env.INTERNAL_API_TOKEN), express.json({ limit: '1mb' }), internalRoutes(registry));

  app.use((_req, res) => {
    res.status(404).json({ code: 'NOT_FOUND', category: 'BAD_RESPONSE', message: 'No such route', retryAfterSeconds: null });
  });
  app.use(errorHandler);
  return app;
}
