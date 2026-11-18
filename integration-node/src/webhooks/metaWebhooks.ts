import { randomUUID } from 'node:crypto';
import express, { Router } from 'express';
import { logger } from '../config/logger.js';
import type { BloomApi } from '../shared/bloomApi.js';
import { verifySignedRequest } from './metaSignedRequest.js';

/**
 * Meta app callbacks required for Instagram app review:
 * - Deauthorize: the owner removed Bloom in Instagram → credentials dropped, account marked REVOKED.
 * - Data deletion: the owner asked Meta to delete their data → account and snapshots deleted; Meta expects a status
 *   URL and confirmation code in the response.
 * Both verify the HMAC-SHA256 signed_request with the app secret before acting.
 */
export function metaWebhookRoutes(bloom: BloomApi, appSecret: string, appPublicUrl: string): Router {
  const router = Router();
  router.use(express.urlencoded({ extended: false, limit: '16kb' }));

  router.post('/webhooks/instagram/deauthorize', async (req, res) => {
    const payload = verifySignedRequest(String(req.body?.signed_request ?? ''), appSecret);
    if (!payload?.user_id) {
      res.status(400).json({ error: 'invalid signed_request' });
      return;
    }
    try {
      const { matched } = await bloom.accountDeauthorized('INSTAGRAM', String(payload.user_id));
      logger.info('instagram deauthorize received', { matched });
      res.json({ ok: true });
    } catch {
      res.status(503).json({ error: 'temporarily unavailable' });
    }
  });

  router.post('/webhooks/instagram/data-deletion', async (req, res) => {
    const payload = verifySignedRequest(String(req.body?.signed_request ?? ''), appSecret);
    if (!payload?.user_id) {
      res.status(400).json({ error: 'invalid signed_request' });
      return;
    }
    try {
      const { matched } = await bloom.accountDataDeletion('INSTAGRAM', String(payload.user_id));
      const confirmation = randomUUID();
      logger.info('instagram data deletion received', { matched, confirmation });
      res.json({
        url: `${appPublicUrl.replace(/\/$/, '')}/settings/connected-accounts?deletion=${confirmation}`,
        confirmation_code: confirmation,
      });
    } catch {
      res.status(503).json({ error: 'temporarily unavailable' });
    }
  });

  return router;
}
