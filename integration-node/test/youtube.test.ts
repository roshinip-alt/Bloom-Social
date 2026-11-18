import { describe, expect, it } from 'vitest';
import { YouTubeAdapter, classifyGoogleError, parseIsoDuration } from '../src/providers/youtube/youtubeAdapter.js';
import { FakeFetch, noWait } from './fakeFetch.js';

const READONLY = 'https://www.googleapis.com/auth/youtube.readonly';
const ANALYTICS = 'https://www.googleapis.com/auth/yt-analytics.readonly';

function adapter(fake: FakeFetch) {
  return new YouTubeAdapter({ clientId: 'cid', clientSecret: 'secret' }, { fetch: fake.fetch, ...noWait });
}

describe('YouTubeAdapter', () => {
  it('requests offline, read-only access with PKCE S256', () => {
    const url = new URL(adapter(new FakeFetch()).authorizeUrl({ state: 'state-value-123456', codeChallenge: 'challenge', redirectUri: 'https://app.test/cb' }));
    expect(url.searchParams.get('scope')).toBe(`${READONLY} ${ANALYTICS}`);
    expect(url.searchParams.get('access_type')).toBe('offline');
    expect(url.searchParams.get('code_challenge')).toBe('challenge');
    expect(url.searchParams.get('code_challenge_method')).toBe('S256');
    expect(url.searchParams.get('scope')).not.toMatch(/upload|monetary|force-ssl/);
  });

  it('sends the PKCE verifier with the code exchange', async () => {
    const fake = new FakeFetch().on('POST oauth2.googleapis.com/token', { body: { access_token: 'at', refresh_token: 'rt', expires_in: 3599, scope: `${READONLY} ${ANALYTICS}` } });
    const tokens = await adapter(fake).exchangeCode({ code: 'c', codeVerifier: 'verifier', redirectUri: 'https://app.test/cb' });
    expect(new URLSearchParams(fake.calls[0]!.body).get('code_verifier')).toBe('verifier');
    expect(tokens).toMatchObject({ accessToken: 'at', refreshToken: 'rt', scopes: [READONLY, ANALYTICS] });
  });

  it('maps invalid_grant on refresh to AUTH_INVALID (reconnect, no retry)', async () => {
    const fake = new FakeFetch().on('POST oauth2.googleapis.com/token', { status: 400, body: { error: 'invalid_grant', error_description: 'Token has been expired or revoked.' } });
    await expect(adapter(fake).refresh({ accessToken: 'a', refreshToken: 'r' })).rejects.toMatchObject({ category: 'AUTH_INVALID', code: 'invalid_grant' });
    expect(fake.calls).toHaveLength(1);
  });

  it('offers every channel the Google identity owns, or explains when there is none', async () => {
    const two = new FakeFetch().on('GET www.googleapis.com/youtube/v3/channels', { body: { items: [
      { id: 'UC1', snippet: { title: 'Main', customUrl: '@main' } }, { id: 'UC2', snippet: { title: 'Brand' } }] } });
    expect((await adapter(two).discoverIdentities({ accessToken: 't', scopes: [] })).map((i) => i.providerAccountId)).toEqual(['UC1', 'UC2']);

    const none = new FakeFetch().on('GET www.googleapis.com/youtube/v3/channels', { body: { items: [] } });
    const [identity] = await adapter(none).discoverIdentities({ accessToken: 't', scopes: [] });
    expect(identity).toMatchObject({ eligible: false });
  });

  it('classifies quota and permission errors', () => {
    expect(classifyGoogleError(403, { error: { errors: [{ reason: 'quotaExceeded' }] } }).category).toBe('RATE_LIMITED');
    expect(classifyGoogleError(403, { error: { errors: [{ reason: 'insufficientPermissions' }] } }).category).toBe('PERMISSION');
    expect(classifyGoogleError(401, {}).category).toBe('AUTH_INVALID');
  });

  it('syncs public stats, delayed analytics and paginated uploads', async () => {
    const fake = new FakeFetch()
      .on('GET www.googleapis.com/youtube/v3/channels', { body: { items: [{ id: 'UC1', snippet: { title: 'Main' },
        statistics: { hiddenSubscriberCount: true, subscriberCount: '0', viewCount: '1000', videoCount: '3' },
        contentDetails: { relatedPlaylists: { uploads: 'UU1' } } }] } })
      .on('GET youtubeanalytics.googleapis.com/v2/reports', (req) => {
        const dims = req.url.searchParams.get('dimensions');
        if (dims === 'day') return { body: { columnHeaders: [{ name: 'day' }, { name: 'views' }, { name: 'estimatedMinutesWatched' }], rows: [['2026-01-01', 10, 30]] } };
        if (dims === 'ageGroup,gender') return { body: { columnHeaders: [{ name: 'ageGroup' }, { name: 'gender' }, { name: 'viewerPercentage' }], rows: [['age25-34', 'female', 60.5]] } };
        return { body: { columnHeaders: [{ name: 'country' }, { name: 'views' }], rows: [['US', 7]] } };
      })
      .once('GET www.googleapis.com/youtube/v3/playlistItems', { body: { items: [{ contentDetails: { videoId: 'v1', videoPublishedAt: new Date().toISOString() } }], nextPageToken: 'p2' } })
      .once('GET www.googleapis.com/youtube/v3/playlistItems', { body: { items: [{ contentDetails: { videoId: 'v2', videoPublishedAt: '2019-01-01T00:00:00Z' } }] } })
      .on('GET www.googleapis.com/youtube/v3/videos', { body: { items: [
        { id: 'v1', snippet: { title: 'One', publishedAt: '2026-01-01T10:00:00Z' }, statistics: { viewCount: '100', likeCount: '5' }, contentDetails: { duration: 'PT4M5S' } },
        { id: 'v2', snippet: { title: 'Two', publishedAt: '2019-01-01T10:00:00Z' }, statistics: { viewCount: '9' }, contentDetails: { duration: 'PT59S' } }] } });

    const result = await adapter(fake).sync({ accountId: 'a', providerAccountId: 'UC1', accessToken: 't', cursor: null,
      grantedScopes: [READONLY, ANALYTICS], since: '2026-01-01', until: '2026-01-03' });

    expect(fake.callsTo('GET www.googleapis.com/youtube/v3/playlistItems')[1]!.url.searchParams.get('pageToken')).toBe('p2');
    expect(result.accountMetrics.find((m) => m.metricKey === 'youtube.subscriber_count')).toMatchObject({ value: null, availability: 'NOT_SUPPORTED' });
    expect(result.accountMetrics.filter((m) => m.metricKey === 'youtube.views')).toHaveLength(1); // delayed days are absent, not zero
    expect(result.accountMetrics.find((m) => m.metricKey === 'youtube.viewer_percentage')?.dimensions).toEqual({ ageGroup: 'age25-34', gender: 'female' });
    expect(result.posts[0]).toMatchObject({ providerContentId: 'v1', durationSeconds: 245 });
    expect(result.posts[1]!.metrics.find((m) => m.metricKey === 'youtube.post.likes')).toMatchObject({ value: null, availability: 'NOT_SUPPORTED' });
  });

  it('skips private analytics when that scope was not granted', async () => {
    const fake = new FakeFetch().on('GET www.googleapis.com/youtube/v3/channels', { body: { items: [{ id: 'UC1', statistics: { subscriberCount: '10' } }] } });
    const result = await adapter(fake).sync({ accountId: 'a', providerAccountId: 'UC1', accessToken: 't', cursor: null,
      grantedScopes: [READONLY], since: '2026-01-01', until: '2026-01-02' });
    expect(fake.callsTo('GET youtubeanalytics')).toHaveLength(0);
    expect(result.capabilities).not.toContain('ACCOUNT_METRICS');
  });

  it('revokes the refresh token', async () => {
    const fake = new FakeFetch().on('POST oauth2.googleapis.com/revoke', { body: {} });
    expect(await adapter(fake).revoke({ accessToken: 'a', refreshToken: 'r' })).toMatchObject({ supported: true, revoked: true });
    expect(new URLSearchParams(fake.calls[0]!.body).get('token')).toBe('r');
  });

  it('parses ISO-8601 durations', () => {
    expect(parseIsoDuration('PT1H2M3S')).toBe(3723);
    expect(parseIsoDuration('P1DT1S')).toBe(86401);
    expect(parseIsoDuration('bogus')).toBeNull();
  });
});
