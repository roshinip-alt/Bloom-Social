import { createApp } from './app.js';
import { loadEnv } from './config/env.js';
import { logger } from './config/logger.js';
import { ProviderRegistry } from './providers/registry.js';
import { BloomApi } from './shared/bloomApi.js';

const env = loadEnv();
if (!env.INTERNAL_API_TOKEN) {
  logger.warn('INTERNAL_API_TOKEN is empty: internal routes will reject every call');
}
const registry = ProviderRegistry.fromEnv(env);
const app = createApp({ env, registry, bloom: new BloomApi(env.BACKEND_URL, env.INTERNAL_API_TOKEN) });

const server = app.listen(env.PORT, () => {
  logger.info('integration service listening', {
    port: env.PORT,
    providers: registry.all().map((a) => ({ provider: a.provider, configured: a.status().configured })),
  });
});

const shutdown = (signal: string) => {
  logger.info('shutting down', { signal });
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 10_000).unref();
};
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
