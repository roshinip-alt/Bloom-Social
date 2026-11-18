import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { createApp } from '../src/app.js';
import { loadEnv } from '../src/config/env.js';
import { ProviderRegistry } from '../src/providers/registry.js';
import type { ProviderAdapter } from '../src/providers/types.js';
import { BloomApi } from '../src/shared/bloomApi.js';
import { IntegrationError } from '../src/shared/errors.js';
import { signRequest, verifySignedRequest } from '../src/webhooks/metaSignedRequest.js';

const env = loadEnv({ INTERNAL_API_TOKEN: 'internal-secret', APP_PUBLIC_URL: 'https://bloom.test', INSTAGRAM_APP_SECRET: 'meta-secret' });

function fakeAdapter(overrides: Partial<ProviderAdapter> = {}): ProviderAdapter {
  return {
    provider: 'instagram', apiVersion: 'v27.0', scopes: ['instagram_business_basic'], supportsPkce: false,
    status: () => ({ provider: 'instagram', configured: true, scopes: ['instagram_business_basic'], apiVersion: 'v27.0', missingConfig: [] }),
    authorizeUrl: ({ state }) => `https://www.instagram.com/oauth/authorize?state=${state}`,
    exchangeCode: vi.fn(async () => ({ accessToken: 'live-token', scopes: ['instagram_business_basic'] })),
    discoverIdentities: vi.fn(async () => [{ providerAccountId: '1789', handle: 'studio', eligible: true }]),
    capabilitiesFor: () => ['PROFILE_READ'],
    refresh: vi.fn(),
    revoke: vi.fn(async () => ({ supported: false, revoked: false, note: 'n/a' })),
    sync: vi.fn(async () => ({ profile: null, capabilities: null, accountMetrics: [], posts: [], nextCursor: {}, complete: true, warnings: [] })),
    ...overrides,
  } as ProviderAdapter;
}

function fakeBloom() {
  const bloom = new BloomApi('http://backend.test', 'internal-secret');
  return Object.assign(bloom, {
    resolveSession: vi.fn(async () => ({ sessionId: 'sess-1', codeVerifier: 'verifier', redirectUri: 'https://bloom.test/oauth/instagram/callback' })),
    completeSession: vi.fn(async () => ({ sessionId: 'sess-1', status: 'COMPLETED', returnPath: '/settings/connected-accounts?session=sess-1' })),
    failSession: vi.fn(async () => ({ sessionId: 'sess-1', status: 'FAILED', returnPath: '/settings/connected-accounts?session=sess-1' })),
    failByState: vi.fn(async () => ({ sessionId: 'sess-1', status: 'FAILED', returnPath: '/settings/connected-accounts?session=sess-1' })),
    accountDeauthorized: vi.fn(async () => ({ matched: true })),
    accountDataDeletion: vi.fn(async () => ({ matched: true })),
  });
}

function app(adapter = fakeAdapter(), bloom = fakeBloom()) {
  return { app: createApp({ env, registry: new ProviderRegistry([adapter]), bloom }), bloom, adapter };
}

describe('internal routes', () => {
  it('reject calls without the internal token', async () => {
    const { app: a } = app();
    await request(a).get('/internal/v1/providers').expect(401);
    await request(a).get('/internal/v1/providers').set('X-Internal-Token', 'wrong-secret!!').expect(401);
  });

  it('list providers and validate sync requests', async () => {
    const { app: a } = app();
    const res = await request(a).get('/internal/v1/providers').set('X-Internal-Token', 'internal-secret').expect(200);
    expect(res.body.providers[0]).toMatchObject({ provider: 'instagram', configured: true });
    const bad = await request(a).post('/internal/v1/providers/instagram/sync').set('X-Internal-Token', 'internal-secret').send({}).expect(400);
    expect(bad.body.code).toBe('INVALID_REQUEST');
  });

  it('return the error category Java uses for retry decisions', async () => {
    const { app: a } = app(fakeAdapter({ sync: vi.fn(async () => { throw new IntegrationError('RATE_LIMITED', 'IG_RATE_LIMITED', 'slow down', 600); }) }));
    const res = await request(a).post('/internal/v1/providers/instagram/sync').set('X-Internal-Token', 'internal-secret')
      .send({ accountId: 'a', providerAccountId: 'p', accessToken: 't', grantedScopes: [], cursor: null, since: '2026-01-01', until: '2026-01-02' })
      .expect(429);
    expect(res.body).toEqual({ code: 'IG_RATE_LIMITED', category: 'RATE_LIMITED', message: 'slow down', retryAfterSeconds: 600 });
  });
});

describe('OAuth callback', () => {
  it('exchanges the code server-side and redirects back to settings', async () => {
    const { app: a, bloom, adapter } = app();
    const res = await request(a).get('/oauth/instagram/callback?code=auth-code&state=state-123').expect(302);
    expect(res.headers.location).toBe('https://bloom.test/settings/connected-accounts?session=sess-1');
    expect(res.headers['cache-control']).toBe('no-store');
    expect(bloom.resolveSession).toHaveBeenCalledWith('instagram', 'state-123', expect.any(String));
    expect(adapter.exchangeCode).toHaveBeenCalledWith({ code: 'auth-code', codeVerifier: 'verifier', redirectUri: 'https://bloom.test/oauth/instagram/callback' });
    expect(bloom.completeSession).toHaveBeenCalledWith('sess-1', expect.objectContaining({ capabilities: ['PROFILE_READ'] }), expect.any(String));
    expect(res.headers.location).not.toContain('live-token');
  });

  it('records a denied consent without exchanging anything', async () => {
    const { app: a, bloom, adapter } = app();
    await request(a).get('/oauth/instagram/callback?error=access_denied&state=state-123').expect(302);
    expect(bloom.failByState).toHaveBeenCalledWith('instagram', 'state-123', 'access_denied', expect.stringMatching(/cancelled/), expect.any(String));
    expect(adapter.exchangeCode).not.toHaveBeenCalled();
  });

  it('rejects an unknown or reused state before touching the provider', async () => {
    const bloom = fakeBloom();
    bloom.resolveSession = vi.fn(async () => { throw new IntegrationError('BAD_RESPONSE', 'STATE_ALREADY_USED', 'used'); });
    const { app: a, adapter } = app(fakeAdapter(), bloom);
    const res = await request(a).get('/oauth/instagram/callback?code=c&state=s').expect(302);
    expect(res.headers.location).toBe('https://bloom.test/settings/connected-accounts?connectError=STATE_ALREADY_USED');
    expect(adapter.exchangeCode).not.toHaveBeenCalled();
  });

  it('reports a failed token exchange to Java instead of faking success', async () => {
    const adapter = fakeAdapter({ exchangeCode: vi.fn(async () => { throw new IntegrationError('BAD_RESPONSE', 'IG_OAUTH_ERROR', 'Invalid code'); }) });
    const { app: a, bloom } = app(adapter);
    await request(a).get('/oauth/instagram/callback?code=c&state=s').expect(302);
    expect(bloom.failSession).toHaveBeenCalledWith('sess-1', 'IG_OAUTH_ERROR', 'Invalid code', expect.any(String));
    expect(bloom.completeSession).not.toHaveBeenCalled();
  });

  it('requires a state parameter', async () => {
    const res = await request(app().app).get('/oauth/instagram/callback?code=c').expect(302);
    expect(res.headers.location).toContain('connectError=MISSING_STATE');
  });
});

describe('Meta webhooks', () => {
  it('verify the signed_request before acting', async () => {
    const { app: a, bloom } = app();
    const valid = signRequest({ algorithm: 'HMAC-SHA256', user_id: '1789' }, 'meta-secret');
    await request(a).post('/webhooks/instagram/deauthorize').type('form').send({ signed_request: valid }).expect(200);
    expect(bloom.accountDeauthorized).toHaveBeenCalledWith('INSTAGRAM', '1789');

    const forged = signRequest({ algorithm: 'HMAC-SHA256', user_id: '1789' }, 'other-secret');
    await request(a).post('/webhooks/instagram/deauthorize').type('form').send({ signed_request: forged }).expect(400);
    expect(bloom.accountDeauthorized).toHaveBeenCalledTimes(1);
  });

  it('answer data-deletion requests with a confirmation code', async () => {
    const { app: a, bloom } = app();
    const res = await request(a).post('/webhooks/instagram/data-deletion').type('form')
      .send({ signed_request: signRequest({ algorithm: 'HMAC-SHA256', user_id: '1789' }, 'meta-secret') }).expect(200);
    expect(res.body.confirmation_code).toMatch(/[0-9a-f-]{36}/);
    expect(res.body.url).toContain('https://bloom.test/settings/connected-accounts?deletion=');
    expect(bloom.accountDataDeletion).toHaveBeenCalledWith('INSTAGRAM', '1789');
  });

  it('reject unsupported algorithms', () => {
    expect(verifySignedRequest(signRequest({ algorithm: 'NONE', user_id: '1' }, 's'), 's')).toBeNull();
  });
});
