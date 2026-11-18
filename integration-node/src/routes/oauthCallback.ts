import { Router, type Request, type Response } from 'express';
import { logger } from '../config/logger.js';
import type { ProviderRegistry } from '../providers/registry.js';
import type { ProviderCode } from '../providers/types.js';
import type { BloomApi } from '../shared/bloomApi.js';
import { IntegrationError } from '../shared/errors.js';

const SETTINGS_PATH = '/settings/connected-accounts';

/**
 * Public redirect target registered with each provider: {APP_PUBLIC_URL}/oauth/{provider}/callback.
 * 1. Java validates the state (hash lookup, provider match, expiry, single use) and hands back the PKCE verifier.
 * 2. The code is exchanged server-side and the authorized identities are discovered.
 * 3. Java stores the encrypted tokens and decides between "connected" and "choose an account".
 * The browser only ever sees a redirect back to Settings → Connected Accounts — never a token.
 */
export function oauthCallbackRoutes(registry: ProviderRegistry, bloom: BloomApi, appPublicUrl: string): Router {
  const router = Router();
  const base = appPublicUrl.replace(/\/$/, '');

  router.get('/oauth/:provider/callback', async (req: Request, res: Response) => {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Referrer-Policy', 'no-referrer');
    const cid = res.locals.correlationId as string;
    const providerParam = String(req.params.provider ?? '').toLowerCase();
    const redirect = (path: string) => res.redirect(302, base + path);
    const failRedirect = (code: string) => redirect(`${SETTINGS_PATH}?connectError=${encodeURIComponent(code)}`);

    let adapter;
    try {
      adapter = registry.get(providerParam);
    } catch {
      return failRedirect('UNKNOWN_PROVIDER');
    }
    const provider = adapter.provider as ProviderCode;
    const state = typeof req.query.state === 'string' ? req.query.state : '';
    const code = typeof req.query.code === 'string' ? req.query.code : '';
    const providerError = typeof req.query.error === 'string' ? req.query.error : '';
    if (!state) return failRedirect('MISSING_STATE');

    if (providerError || !code) {
      // e.g. the owner pressed "Cancel" on the consent screen (access_denied).
      const description = typeof req.query.error_description === 'string' ? req.query.error_description : '';
      try {
        const outcome = await bloom.failByState(provider, state, providerError || 'MISSING_CODE',
          describeProviderError(providerError, description), cid);
        return redirect(outcome.returnPath);
      } catch {
        return failRedirect(providerError || 'MISSING_CODE');
      }
    }

    let session;
    try {
      session = await bloom.resolveSession(provider, state, cid);
    } catch (e) {
      const errorCode = e instanceof IntegrationError ? e.code : 'STATE_INVALID';
      logger.warn('oauth state rejected', { provider, correlationId: cid, errorCode });
      return failRedirect(errorCode);
    }

    try {
      const tokens = await adapter.exchangeCode({ code, codeVerifier: session.codeVerifier, redirectUri: session.redirectUri });
      const identities = await adapter.discoverIdentities(tokens);
      const granted = tokens.scopes.length > 0 ? tokens.scopes : adapter.scopes;
      const outcome = await bloom.completeSession(session.sessionId,
        { tokens: { ...tokens, scopes: granted }, identities, capabilities: adapter.capabilitiesFor(granted) }, cid);
      logger.info('oauth connection completed', { provider, correlationId: cid, status: outcome.status, identities: identities.length });
      return redirect(outcome.returnPath);
    } catch (e) {
      const err = e instanceof IntegrationError ? e : new IntegrationError('TRANSIENT', 'CALLBACK_FAILED', 'The connection could not be completed');
      logger.warn('oauth connection failed', { provider, correlationId: cid, category: err.category, errorCode: err.code });
      try {
        const outcome = await bloom.failSession(session.sessionId, err.code, err.message, cid);
        return redirect(outcome.returnPath);
      } catch {
        return failRedirect(err.code);
      }
    }
  });

  return router;
}

function describeProviderError(error: string, description: string): string {
  if (error === 'access_denied') return 'You cancelled the request or did not grant access. Nothing was connected.';
  return description ? description.slice(0, 300) : 'The provider did not return an authorization code.';
}
