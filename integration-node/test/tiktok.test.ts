import { describe, expect, it } from 'vitest';
import { TikTokAdapter, VIDEO_PAGE_SIZE, classifyTikTokError } from '../src/providers/tiktok/tiktokAdapter.js';
import { FakeFetch, noWait } from './fakeFetch.js';

const ALL = ['user.info.basic', 'user.info.profile', 'user.info.stats', 'video.list'];

function adapter(fake: FakeFetch) {
  return new TikTokAdapter({ clientKey: 'ck', clientSecret: 'cs' }, { fetch: fake.fetch, ...noWait });
}

const user = { data: { user: { open_id: 'open-1', display_name: 'Fern', username: 'fern', follower_count: 900, likes_count: 5000, video_count: 12 } }, error: { code: 'ok', message: '' } };

describe('TikTokAdapter', () => {
  it('uses client_key and no PKCE for the web flow', () => {
    const url = new URL(adapter(new FakeFetch()).authorizeUrl({ state: 'state-value-123456', codeChallenge: 'c'.repeat(43), redirectUri: 'https://app.test/cb' }));
    expect(url.searchParams.get('client_key')).toBe('ck');
    expect(url.searchParams.get('scope')).toBe(ALL.join(','));
    expect(url.searchParams.get('code_challenge')).toBeNull();
  });

  it('never claims audience insights, and drops stats without user.info.stats', () => {
    const a = adapter(new FakeFetch());
    expect(a.capabilitiesFor(ALL)).not.toContain('AUDIENCE_INSIGHTS');
    expect(a.capabilitiesFor(['user.info.basic', 'video.list'])).not.toContain('ACCOUNT_METRICS');
  });

  it('stores the rotated refresh token and lifetimes from the response', async () => {
    const fake = new FakeFetch().on('POST open.tiktokapis.com/v2/oauth/token/', { body: { access_token: 'a2', refresh_token: 'r2', expires_in: 86400, refresh_expires_in: 31536000, scope: 'user.info.basic,video.list' } });
    expect(await adapter(fake).refresh({ accessToken: 'a1', refreshToken: 'r1' })).toMatchObject({ accessToken: 'a2', refreshToken: 'r2', refreshExpiresInSeconds: 31536000, scopes: ['user.info.basic', 'video.list'] });
  });

  it('uses the app-scoped open_id as the account id', async () => {
    const fake = new FakeFetch().on('GET open.tiktokapis.com/v2/user/info/', { body: user });
    const [identity] = await adapter(fake).discoverIdentities({ accessToken: 't', scopes: ALL });
    expect(identity).toMatchObject({ providerAccountId: 'open-1', handle: 'fern', eligible: true });
  });

  it('classifies body error codes, including on HTTP 200', () => {
    expect(classifyTikTokError(401, { error: { code: 'access_token_invalid' } }).category).toBe('AUTH_INVALID');
    expect(classifyTikTokError(200, { error: { code: 'scope_not_authorized' } }).category).toBe('PERMISSION');
    expect(classifyTikTokError(429, { error: { code: 'rate_limit_exceeded' } }).category).toBe('RATE_LIMITED');
  });

  it('pages through videos with the cursor until has_more is false', async () => {
    const now = Math.floor(Date.now() / 1000);
    const fake = new FakeFetch()
      .on('GET open.tiktokapis.com/v2/user/info/', { body: user })
      .once('POST open.tiktokapis.com/v2/video/list/', { body: { data: { videos: [{ id: 'v1', create_time: now, view_count: 10 }], cursor: 111, has_more: true }, error: { code: 'ok' } } })
      .once('POST open.tiktokapis.com/v2/video/list/', { body: { data: { videos: [{ id: 'v2', create_time: now - 10 }], cursor: 222, has_more: false }, error: { code: 'ok' } } });
    const result = await adapter(fake).sync({ accountId: 'a', providerAccountId: 'open-1', accessToken: 't', cursor: null, grantedScopes: ALL, since: '2026-01-01', until: '2026-01-02' });
    const bodies = fake.callsTo('POST open.tiktokapis.com/v2/video/list/').map((c) => JSON.parse(c.body!));
    expect(bodies).toEqual([{ max_count: VIDEO_PAGE_SIZE }, { max_count: VIDEO_PAGE_SIZE, cursor: 111 }]);
    expect(result.posts.map((p) => p.providerContentId)).toEqual(['v1', 'v2']);
    expect(result.posts[1]!.metrics.find((m) => m.metricKey === 'tiktok.post.view_count')).toMatchObject({ value: null, availability: 'NOT_SUPPORTED' });
    expect(result.accountMetrics.find((m) => m.metricKey === 'tiktok.follower_count')?.value).toBe(900);
  });

  it('labels stats as permission-missing when user.info.stats was not granted', async () => {
    const fake = new FakeFetch().on('GET open.tiktokapis.com/v2/user/info/', (req) => {
      expect(req.url.searchParams.get('fields')).not.toContain('follower_count');
      return { body: { data: { user: { open_id: 'open-1' } }, error: { code: 'ok' } } };
    });
    const result = await adapter(fake).sync({ accountId: 'a', providerAccountId: 'open-1', accessToken: 't', cursor: null, grantedScopes: ['user.info.basic'], since: '2026-01-01', until: '2026-01-02' });
    expect(result.accountMetrics.every((m) => m.value === null && m.availability === 'PERMISSION_MISSING')).toBe(true);
  });
});
