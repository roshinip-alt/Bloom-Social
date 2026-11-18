import { logger } from '../config/logger.js';
import { IntegrationError } from '../shared/errors.js';
import type { ProviderAdapter, SyncRequest, SyncResult } from '../providers/types.js';

/**
 * Executes one sync job for the Java scheduler. Java owns scheduling, retries and persistence; this worker only
 * fetches from the official API within the requested window and returns normalized, idempotent data.
 */
export async function runSync(adapter: ProviderAdapter, request: SyncRequest, correlationId?: string): Promise<SyncResult> {
  if (request.since > request.until) {
    throw new IntegrationError('BAD_RESPONSE', 'INVALID_WINDOW', 'The sync window is empty');
  }
  const started = Date.now();
  try {
    const result = await adapter.sync(request);
    logger.info('sync finished', {
      provider: adapter.provider,
      accountId: request.accountId,
      correlationId,
      metrics: result.accountMetrics.length,
      posts: result.posts.length,
      complete: result.complete,
      warnings: result.warnings.length,
      ms: Date.now() - started,
    });
    return result;
  } catch (e) {
    const err = e instanceof IntegrationError ? e : new IntegrationError('TRANSIENT', 'SYNC_FAILED', 'Unexpected sync failure');
    logger.warn('sync failed', {
      provider: adapter.provider,
      accountId: request.accountId,
      correlationId,
      category: err.category,
      errorCode: err.code,
      ms: Date.now() - started,
    });
    throw err;
  }
}
