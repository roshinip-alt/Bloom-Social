import { describe, expect, it } from 'vitest';
import { InstagramAdapter, MAX_INSIGHT_DAYS, classifyGraphError } from '../src/providers/instagram/instagramAdapter.js';
import { FakeFetch, noWait } from './fakeFetch.js';

const config = { appId: 'app-id', appSecret: 'app-secret', apiVersion: 'v27.0' };
const profile = { id: 'scoped', user_id: '1789', username: 'studio', name: 'Studio', account_type: 'MEDIA_CREATOR', followers_count: 2500, media_count: 40 };

function adapter(fake: FakeFetch) {
  return new InstagramAdapter(config, { fetch: fake.fetch, ...noWait });
}

describe('InstagramAdapter', () => {
  it('builds a least-privilege authorize URL without PKCE', () => {
    const url = new URL(adapter(new FakeFetch()).authorizeUrl({ state: 's'.repeat(32), codeChallenge: 'c'.repeat(43), redirectUri: 'https://app.test/oauth/instagram/callback' }));
    expect(url.origin + url.pathname).toBe('https://www.instagram.com/oauth/authorize');
    expect(url.searchParams.get('scope')).toBe('instagram_business_basic,instagram_business_manage_insights');
    expect(url.searchParams.get('code_challenge')).toBeNull();
    expect(url.searchParams.get('state')).toBe('s'.repeat(32));
  });

  it('refuses to start without app credentials', () => {
    const a = new InstagramAdapter({ appId: '', appSecret: '', apiVersion: 'v27.0' });
    expect(a.status()).toMatchObject({ configured: false, missingConfig: ['INSTAGRAM_APP_ID', 'INSTAGRAM_APP_SECRET'] });
    expect(() => a.authorizeUrl({ state: 's', codeChallenge: 'c', redirectUri: 'https://x' })).toThrow(/not configured/);
  });

  it('exchanges the code server-side and upgrades to a long-lived token', async () => {
    const fake = new FakeFetch()
      .on('POST api.instagram.com/oauth/access_token', { body: { data: [{ access_token: 'short', user_id: '1789', permissions: 'instagram_business_basic,instagram_business_manage_insights' }] } })
      .on('GET graph.instagram.com/access_token', { body: { access_token: 'long', token_type: 'bearer', expires_in: 5184000 } });
    const tokens = await adapter(fake).exchangeCode({ code: 'abc#_', codeVerifier: 'v', redirectUri: 'https://app.test/cb' });
    expect(tokens).toMatchObject({ accessToken: 'long', expiresInSeconds: 5184000, scopes: ['instagram_business_basic', 'instagram_business_manage_insights'] });
    const form = new URLSearchParams(fake.calls[0]!.body);
    expect(form.get('code')).toBe('abc');
    expect(form.get('client_secret')).toBe('app-secret');
    expect(fake.calls[1]!.url.searchParams.get('grant_type')).toBe('ig_exchange_token');
  });

  it('marks personal accounts ineligible with an explanation', async () => {
    const fake = new FakeFetch().on('GET graph.instagram.com/v27.0/me', { body: { ...profile, account_type: 'PERSONAL' } });
    const [identity] = await adapter(fake).discoverIdentities({ accessToken: 't', scopes: [] });
    expect(identity).toMatchObject({ providerAccountId: '1789', eligible: false });
    expect(identity!.ineligibleReason).toMatch(/Business or Creator/);
  });

  it('classifies Graph API errors', () => {
    expect(classifyGraphError(400, { error: { code: 190, message: 'expired' } }).category).toBe('AUTH_INVALID');
    expect(classifyGraphError(400, { error: { code: 10 } }).category).toBe('PERMISSION');
    expect(classifyGraphError(400, { error: { code: 4 } }).category).toBe('RATE_LIMITED');
    expect(classifyGraphError(500, { error: { code: 2 } }).category).toBe('TRANSIENT');
  });

  it('syncs profile, daily insights, demographics and paginated media', async () => {
    const fake = new FakeFetch()
      .on('GET graph.instagram.com/v27.0/me', { body: profile })
      .on('GET graph.instagram.com/v27.0/1789/insights', (req) => {
        if (req.url.searchParams.get('metric') === 'follower_demographics') {
          const breakdown = req.url.searchParams.get('breakdown');
          return breakdown === 'city'
            ? { body: { data: [] } }
            : { body: { data: [{ total_value: { breakdowns: [{ results: [{ dimension_values: [breakdown === 'age' ? '25-34' : 'GB'], value: 900 }] }] } }] } };
        }
        return { body: { data: [{ name: 'reach', total_value: { value: 120 } }, { name: 'views', total_value: { value: 300 } }] } };
      })
      .once('GET graph.instagram.com/v27.0/1789/media', {
        body: { data: [{ id: 'm1', media_type: 'VIDEO', media_product_type: 'REELS', timestamp: new Date().toISOString(), caption: 'Reel' }],
          paging: { next: 'https://graph.instagram.com/v27.0/1789/media?after=x' } },
      })
      .once('GET graph.instagram.com/v27.0/1789/media', {
        body: { data: [{ id: 'm2', media_type: 'IMAGE', media_product_type: 'FEED', timestamp: '2020-01-01T00:00:00+0000' }] },
      })
      .on('GET graph.instagram.com/v27.0/m1/insights', { body: { data: [{ name: 'reach', values: [{ value: 50 }] }, { name: 'views', values: [{ value: 80 }] }] } })
      .on('GET graph.instagram.com/v27.0/m2/insights', { status: 400, body: { error: { code: 10, message: '(#10) Not enough viewers for the media to show insights' } } });

    const result = await adapter(fake).sync({
      accountId: 'a', providerAccountId: '1789', accessToken: 'tok', cursor: null,
      grantedScopes: ['instagram_business_basic', 'instagram_business_manage_insights'], since: '2026-01-01', until: '2026-01-02',
    });

    expect(result.complete).toBe(true);
    expect(result.capabilities).toContain('AUDIENCE_INSIGHTS');
    expect(result.accountMetrics.find((m) => m.metricKey === 'instagram.followers_count')?.value).toBe(2500);
    expect(result.accountMetrics.filter((m) => m.metricKey === 'instagram.reach').map((m) => m.date)).toEqual(['2026-01-01', '2026-01-02']);
    const city = result.accountMetrics.find((m) => m.dimensions.city);
    expect(city).toMatchObject({ value: null, availability: 'NOT_ENOUGH_DATA' });
    expect(result.posts.map((p) => [p.providerContentId, p.contentType])).toEqual([['m1', 'REEL'], ['m2', 'IMAGE']]);
    expect(result.posts[0]!.metrics.find((m) => m.metricKey === 'instagram.post.views')?.value).toBe(80);
    // Withheld insights are recorded as unavailable, not zero.
    expect(result.posts[1]!.metrics.every((m) => m.value === null && m.availability === 'NOT_ENOUGH_DATA')).toBe(true);
  });

  it('limits the insights backfill and says so', async () => {
    const fake = new FakeFetch()
      .on('GET graph.instagram.com/v27.0/me', { body: profile })
      .on('GET graph.instagram.com/v27.0/1789/insights', { body: { data: [] } })
      .on('GET graph.instagram.com/v27.0/1789/media', { body: { data: [] } });
    const result = await adapter(fake).sync({ accountId: 'a', providerAccountId: '1789', accessToken: 't', cursor: null,
      grantedScopes: ['instagram_business_basic', 'instagram_business_manage_insights'], since: '2025-10-01', until: '2026-01-31' });
    const dayCalls = fake.callsTo('GET graph.instagram.com/v27.0/1789/insights').filter((c) => c.url.searchParams.get('period') === 'day');
    expect(dayCalls).toHaveLength(MAX_INSIGHT_DAYS);
    expect(result.warnings.join(' ')).toMatch(/latest 30 days/);
  });

  it('without the insights scope only reads profile and media', async () => {
    const fake = new FakeFetch()
      .on('GET graph.instagram.com/v27.0/me', { body: profile })
      .on('GET graph.instagram.com/v27.0/1789/media', { body: { data: [] } });
    const result = await adapter(fake).sync({ accountId: 'a', providerAccountId: '1789', accessToken: 't', cursor: null,
      grantedScopes: ['instagram_business_basic'], since: '2026-01-01', until: '2026-01-02' });
    expect(fake.callsTo('GET graph.instagram.com/v27.0/1789/insights')).toHaveLength(0);
    expect(result.capabilities).not.toContain('ACCOUNT_METRICS');
    expect(result.warnings[0]).toMatch(/Insights permission not granted/);
  });

  it('aborts the sync when the token is rejected', async () => {
    const fake = new FakeFetch().on('GET graph.instagram.com/v27.0/me', { status: 400, body: { error: { code: 190, message: 'Session expired' } } });
    await expect(adapter(fake).sync({ accountId: 'a', providerAccountId: '1789', accessToken: 't', cursor: null,
      grantedScopes: [], since: '2026-01-01', until: '2026-01-01' })).rejects.toMatchObject({ category: 'AUTH_INVALID' });
  });

  it('has no revocation endpoint and says so', async () => {
    expect(await adapter(new FakeFetch()).revoke()).toMatchObject({ supported: false, revoked: false });
  });
});
