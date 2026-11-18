import { IntegrationError, notConfigured } from '../../shared/errors.js';
import { HttpClient, classifyByStatus, type HttpClientOptions } from '../../shared/http.js';
import { SyncCollector, addDays, num } from '../../workers/syncCollector.js';
import type {
  Capability,
  Identity,
  PostData,
  ProviderAdapter,
  ProviderStatus,
  RevokeResult,
  SyncRequest,
  SyncResult,
  TokenSet,
} from '../types.js';

/**
 * Google OAuth 2.0 (web server, PKCE S256, offline access) + YouTube Data API v3 (public channel/video metadata)
 * + YouTube Analytics API v2 (private, delayed channel reports). Facts checked 2026-11-10 — docs/integrations/youtube.md.
 * Only read-only scopes are requested; no upload/manage or monetary scopes.
 */
export interface YouTubeConfig {
  clientId: string;
  clientSecret: string;
  authorizeUrl?: string;
  tokenUrl?: string;
  revokeUrl?: string;
  dataApiBase?: string;
  analyticsBase?: string;
}

const SCOPE_READONLY = 'https://www.googleapis.com/auth/youtube.readonly';
const SCOPE_ANALYTICS = 'https://www.googleapis.com/auth/yt-analytics.readonly';
const DAILY_METRICS: [string, string][] = [
  ['views', 'youtube.views'],
  ['estimatedMinutesWatched', 'youtube.estimated_minutes_watched'],
  ['averageViewDuration', 'youtube.average_view_duration'],
  ['likes', 'youtube.likes'],
  ['comments', 'youtube.comments'],
  ['shares', 'youtube.shares'],
  ['subscribersGained', 'youtube.subscribers_gained'],
  ['subscribersLost', 'youtube.subscribers_lost'],
];
const MAX_VIDEOS = 100;

interface GoogleError {
  error?: string | { code?: number; message?: string; errors?: { reason?: string }[] };
  error_description?: string;
}

export function classifyGoogleError(status: number, body: unknown, retryAfter?: number): IntegrationError {
  const b = (body ?? {}) as GoogleError;
  if (typeof b.error === 'string') {
    // OAuth token endpoint errors
    if (b.error === 'invalid_grant') {
      return new IntegrationError('AUTH_INVALID', 'invalid_grant', 'Google rejected the refresh token; reconnect YouTube');
    }
    return new IntegrationError('BAD_RESPONSE', `GOOGLE_${b.error}`, b.error_description ?? b.error);
  }
  const reason = b.error?.errors?.[0]?.reason ?? '';
  const message = b.error?.message ?? `Google returned HTTP ${status}`;
  if (status === 401) return new IntegrationError('AUTH_INVALID', 'GOOGLE_UNAUTHORIZED', message);
  if (status === 403 && /quotaExceeded|dailyLimitExceeded/.test(reason)) {
    return new IntegrationError('RATE_LIMITED', 'YOUTUBE_QUOTA_EXCEEDED', 'The YouTube API daily quota is used up; sync resumes after the Pacific-time reset.', retryAfter ?? 3600);
  }
  if (status === 403 && /rateLimitExceeded|userRateLimitExceeded/.test(reason)) {
    return new IntegrationError('RATE_LIMITED', 'YOUTUBE_RATE_LIMITED', message, retryAfter ?? 60);
  }
  if (status === 403) return new IntegrationError('PERMISSION', `YOUTUBE_${reason || 'FORBIDDEN'}`, message);
  return classifyByStatus(status, retryAfter);
}

interface Channel {
  id: string;
  snippet?: { title?: string; customUrl?: string; thumbnails?: { default?: { url?: string } } };
  statistics?: { subscriberCount?: string; hiddenSubscriberCount?: boolean; viewCount?: string; videoCount?: string };
  contentDetails?: { relatedPlaylists?: { uploads?: string } };
}

interface ReportTable {
  columnHeaders?: { name: string }[];
  rows?: (string | number)[][];
}

export class YouTubeAdapter implements ProviderAdapter {
  readonly provider = 'youtube' as const;
  readonly apiVersion = 'v3';
  readonly scopes = [SCOPE_READONLY, SCOPE_ANALYTICS];
  readonly supportsPkce = true;
  private readonly http: HttpClient;
  private readonly data: string;
  private readonly analytics: string;

  constructor(
    private readonly config: YouTubeConfig,
    http?: HttpClientOptions,
  ) {
    this.http = new HttpClient(classifyGoogleError, http);
    this.data = config.dataApiBase ?? 'https://www.googleapis.com/youtube/v3';
    this.analytics = config.analyticsBase ?? 'https://youtubeanalytics.googleapis.com/v2';
  }

  status(): ProviderStatus {
    const missing = [!this.config.clientId && 'GOOGLE_CLIENT_ID', !this.config.clientSecret && 'GOOGLE_CLIENT_SECRET'].filter(
      (x): x is string => Boolean(x),
    );
    return { provider: this.provider, configured: missing.length === 0, scopes: this.scopes, apiVersion: this.apiVersion, missingConfig: missing };
  }

  authorizeUrl({ state, codeChallenge, redirectUri }: { state: string; codeChallenge: string; redirectUri: string }): string {
    this.requireConfig();
    const url = new URL(this.config.authorizeUrl ?? 'https://accounts.google.com/o/oauth2/v2/auth');
    url.searchParams.set('client_id', this.config.clientId);
    url.searchParams.set('redirect_uri', redirectUri);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('scope', this.scopes.join(' '));
    // Offline access: background sync needs a refresh token. prompt=consent re-issues it on reconnect.
    url.searchParams.set('access_type', 'offline');
    url.searchParams.set('prompt', 'consent');
    url.searchParams.set('include_granted_scopes', 'true');
    url.searchParams.set('state', state);
    url.searchParams.set('code_challenge', codeChallenge);
    url.searchParams.set('code_challenge_method', 'S256');
    return url.toString();
  }

  async exchangeCode({ code, codeVerifier, redirectUri }: { code: string; codeVerifier: string; redirectUri: string }): Promise<TokenSet> {
    this.requireConfig();
    const res = await this.http.request<GoogleToken>({
      method: 'POST',
      url: this.config.tokenUrl ?? 'https://oauth2.googleapis.com/token',
      form: {
        code,
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
        code_verifier: codeVerifier,
      },
    });
    return toTokenSet(res);
  }

  /** channels.list mine=true returns the channel(s) the consenting Google identity owns. */
  async discoverIdentities(tokens: TokenSet): Promise<Identity[]> {
    const res = await this.http.request<{ items?: Channel[] }>({
      url: `${this.data}/channels`,
      query: { part: 'snippet,statistics', mine: 'true', maxResults: 50 },
      headers: { Authorization: `Bearer ${tokens.accessToken}` },
    });
    const items = res.items ?? [];
    if (items.length === 0) {
      return [{
        providerAccountId: 'no-channel',
        handle: 'no channel',
        eligible: false,
        ineligibleReason: 'This Google account has no YouTube channel. Create a channel or choose the account that owns it.',
      }];
    }
    return items.map((ch) => ({
      providerAccountId: ch.id,
      handle: ch.snippet?.customUrl ?? ch.snippet?.title ?? ch.id,
      displayName: ch.snippet?.title ?? null,
      avatarUrl: ch.snippet?.thumbnails?.default?.url ?? null,
      accountType: 'Channel',
      eligible: true,
      metadata: {},
    }));
  }

  capabilitiesFor(granted: string[]): Capability[] {
    const caps: Capability[] = ['TOKEN_REFRESH'];
    if (granted.includes(SCOPE_READONLY)) caps.push('PROFILE_READ', 'CONTENT_LIST', 'CONTENT_METRICS');
    // reports.query requires youtube.readonly in addition to yt-analytics.readonly.
    if (granted.includes(SCOPE_ANALYTICS) && granted.includes(SCOPE_READONLY)) caps.push('ACCOUNT_METRICS', 'AUDIENCE_INSIGHTS');
    return caps;
  }

  async refresh({ refreshToken }: { accessToken: string; refreshToken?: string | null }): Promise<TokenSet> {
    if (!refreshToken) throw new IntegrationError('AUTH_INVALID', 'NO_REFRESH_TOKEN', 'No refresh token stored; reconnect YouTube');
    const res = await this.http.request<GoogleToken>({
      method: 'POST',
      url: this.config.tokenUrl ?? 'https://oauth2.googleapis.com/token',
      form: { client_id: this.config.clientId, client_secret: this.config.clientSecret, refresh_token: refreshToken, grant_type: 'refresh_token' },
    });
    return toTokenSet(res);
  }

  /** Revoking the refresh token (or access token) also invalidates the other. */
  async revoke({ accessToken, refreshToken }: { accessToken: string; refreshToken?: string | null }): Promise<RevokeResult> {
    await this.http.request({
      method: 'POST',
      url: this.config.revokeUrl ?? 'https://oauth2.googleapis.com/revoke',
      form: { token: refreshToken ?? accessToken },
    });
    return { supported: true, revoked: true, note: null };
  }

  async sync(req: SyncRequest): Promise<SyncResult> {
    const today = new Date().toISOString().slice(0, 10);
    const c = new SyncCollector('v3', today);
    const auth = { Authorization: `Bearer ${req.accessToken}` };
    c.capabilities = this.capabilitiesFor(req.grantedScopes);

    const channel = await this.channel(req.providerAccountId, auth);
    c.profile = { handle: channel.snippet?.customUrl ?? channel.snippet?.title ?? null, displayName: channel.snippet?.title ?? null,
      avatarUrl: channel.snippet?.thumbnails?.default?.url ?? null, accountType: 'Channel' };
    const stats = channel.statistics ?? {};
    // A hidden subscriber count is reported as not supported — never as zero.
    c.stock('youtube.subscriber_count', stats.hiddenSubscriberCount ? null : num(stats.subscriberCount), 'Data API channels.list statistics');
    c.stock('youtube.channel_view_count', num(stats.viewCount), 'Data API channels.list statistics');
    c.stock('youtube.video_count', num(stats.videoCount), 'Data API channels.list statistics');

    if (c.capabilities.includes('ACCOUNT_METRICS')) {
      await c.step('daily analytics', () => this.dailyReport(c, req, auth));
      await c.step('viewer demographics', () => this.demographics(c, req, auth));
      await c.step('views by country', () => this.countries(c, req, auth));
    } else {
      c.warnings.push('YouTube Analytics access was not granted: daily views, watch time and audience are unavailable.');
    }
    const uploads = channel.contentDetails?.relatedPlaylists?.uploads;
    if (uploads) await c.step('videos', () => this.videos(c, uploads, req, auth));
    return c.result();
  }

  // ------------------------------------------------------------------ helpers

  private requireConfig() {
    const s = this.status();
    if (!s.configured) throw notConfigured('YouTube', s.missingConfig);
  }

  private async channel(id: string, auth: Record<string, string>): Promise<Channel> {
    const res = await this.http.request<{ items?: Channel[] }>({
      url: `${this.data}/channels`,
      query: { part: 'snippet,statistics,contentDetails', id },
      headers: auth,
    });
    const ch = res.items?.[0];
    if (!ch) throw new IntegrationError('PERMISSION', 'YOUTUBE_CHANNEL_NOT_FOUND', 'The channel is no longer accessible with this authorization');
    return ch;
  }

  private report(query: Record<string, string | number>, auth: Record<string, string>) {
    return this.http.request<ReportTable>({ url: `${this.analytics}/reports`, query: { ids: 'channel==MINE', ...query }, headers: auth });
  }

  /** Analytics data is delayed: days without rows are simply absent, not zero. */
  private async dailyReport(c: SyncCollector, req: SyncRequest, auth: Record<string, string>) {
    const table = await this.report({
      startDate: req.since,
      endDate: req.until,
      metrics: DAILY_METRICS.map(([m]) => m).join(','),
      dimensions: 'day',
      sort: 'day',
    }, auth);
    const idx = columnIndex(table);
    for (const row of table.rows ?? []) {
      const day = String(row[idx.get('day') ?? 0]);
      for (const [metric, key] of DAILY_METRICS) {
        const i = idx.get(metric);
        if (i !== undefined) c.metric(key, day, 'DAY', {}, num(row[i]), 'Analytics reports.query dimensions=day', 'DELAYED');
      }
    }
  }

  private async demographics(c: SyncCollector, req: SyncRequest, auth: Record<string, string>) {
    const start = addDays(req.until, -27);
    const table = await this.report({ startDate: start, endDate: req.until, metrics: 'viewerPercentage', dimensions: 'ageGroup,gender' }, auth);
    const idx = columnIndex(table);
    const rows = table.rows ?? [];
    if (rows.length === 0) {
      c.metric('youtube.viewer_percentage', req.until, 'PERIOD_28D', { ageGroup: '_unavailable', gender: '_unavailable' }, null,
        'Analytics reports.query dimensions=ageGroup,gender', 'NOT_ENOUGH_DATA');
      return;
    }
    for (const row of rows) {
      c.metric('youtube.viewer_percentage', req.until, 'PERIOD_28D',
        { ageGroup: String(row[idx.get('ageGroup') ?? 0]), gender: String(row[idx.get('gender') ?? 1]) },
        num(row[idx.get('viewerPercentage') ?? 2]), 'Analytics reports.query dimensions=ageGroup,gender');
    }
  }

  private async countries(c: SyncCollector, req: SyncRequest, auth: Record<string, string>) {
    const start = addDays(req.until, -27);
    const table = await this.report({ startDate: start, endDate: req.until, metrics: 'views', dimensions: 'country', sort: '-views', maxResults: 25 }, auth);
    const idx = columnIndex(table);
    for (const row of table.rows ?? []) {
      c.metric('youtube.views_by_country', req.until, 'PERIOD_28D', { country: String(row[idx.get('country') ?? 0]) },
        num(row[idx.get('views') ?? 1]), 'Analytics reports.query dimensions=country');
    }
  }

  /** Uploads playlist pages (50 per page, 1 quota unit each), then videos.list in batches of 50. */
  private async videos(c: SyncCollector, uploads: string, req: SyncRequest, auth: Record<string, string>) {
    const ids: string[] = [];
    let pageToken: string | undefined;
    do {
      const page: { items?: { contentDetails?: { videoId?: string; videoPublishedAt?: string } }[]; nextPageToken?: string } =
        await this.http.request({
          url: `${this.data}/playlistItems`,
          query: { part: 'contentDetails', playlistId: uploads, maxResults: 50, pageToken },
          headers: auth,
        });
      const items = page.items ?? [];
      ids.push(...items.map((i) => i.contentDetails?.videoId).filter((x): x is string => Boolean(x)));
      const oldest = items[items.length - 1]?.contentDetails?.videoPublishedAt;
      pageToken = oldest && oldest.slice(0, 10) >= addDays(req.since, -60) ? page.nextPageToken : undefined;
    } while (pageToken && ids.length < MAX_VIDEOS);

    for (let i = 0; i < Math.min(ids.length, MAX_VIDEOS); i += 50) {
      const batch = ids.slice(i, i + 50);
      const res = await this.http.request<{ items?: Video[] }>({
        url: `${this.data}/videos`,
        query: { part: 'snippet,statistics,contentDetails', id: batch.join(',') },
        headers: auth,
      });
      for (const v of res.items ?? []) c.posts.push(toPost(v));
    }
  }
}

interface GoogleToken {
  access_token: string;
  expires_in?: number;
  refresh_token?: string;
  refresh_token_expires_in?: number;
  scope?: string;
  token_type?: string;
}

interface Video {
  id: string;
  snippet?: { title?: string; publishedAt?: string; thumbnails?: { medium?: { url?: string }; default?: { url?: string } } };
  statistics?: { viewCount?: string; likeCount?: string; commentCount?: string };
  contentDetails?: { duration?: string };
}

function toTokenSet(t: GoogleToken): TokenSet {
  return {
    accessToken: t.access_token,
    refreshToken: t.refresh_token ?? null,
    tokenType: t.token_type ?? 'Bearer',
    scopes: (t.scope ?? '').split(' ').filter(Boolean),
    expiresInSeconds: t.expires_in ?? null,
    refreshExpiresInSeconds: t.refresh_token_expires_in ?? null,
  };
}

function columnIndex(table: ReportTable): Map<string, number> {
  return new Map((table.columnHeaders ?? []).map((h, i) => [h.name, i]));
}

/** ISO-8601 duration (e.g. PT1H2M3S) to seconds. */
export function parseIsoDuration(value?: string): number | null {
  const m = value?.match(/^P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/);
  if (!m) return null;
  const [, d, h, min, s] = m.map((x) => (x ? Number(x) : 0));
  return (d ?? 0) * 86_400 + (h ?? 0) * 3_600 + (min ?? 0) * 60 + (s ?? 0);
}

function toPost(v: Video): PostData {
  const source = 'Data API videos.list statistics';
  const stat = (key: string, value?: string) => {
    const n = num(value);
    // likeCount/commentCount are absent when the owner hides them or disables comments.
    return { metricKey: key, value: n, availability: n === null ? 'NOT_SUPPORTED' as const : 'AVAILABLE' as const, sourceEndpoint: source, apiVersion: 'v3' };
  };
  return {
    providerContentId: v.id,
    contentType: 'VIDEO',
    title: v.snippet?.title ?? null,
    permalink: `https://www.youtube.com/watch?v=${v.id}`,
    thumbnailUrl: v.snippet?.thumbnails?.medium?.url ?? v.snippet?.thumbnails?.default?.url ?? null,
    publishedAt: new Date(v.snippet?.publishedAt ?? Date.now()).toISOString(),
    durationSeconds: parseIsoDuration(v.contentDetails?.duration),
    metrics: [
      stat('youtube.post.views', v.statistics?.viewCount),
      stat('youtube.post.likes', v.statistics?.likeCount),
      stat('youtube.post.comments', v.statistics?.commentCount),
    ],
  };
}
