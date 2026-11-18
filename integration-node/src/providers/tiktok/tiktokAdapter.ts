import { IntegrationError, notConfigured } from '../../shared/errors.js';
import { HttpClient, classifyByStatus, type HttpClientOptions } from '../../shared/http.js';
import { SyncCollector, num } from '../../workers/syncCollector.js';
import type {
  Capability,
  Identity,
  ProviderAdapter,
  ProviderStatus,
  RevokeResult,
  SyncRequest,
  SyncResult,
  TokenSet,
} from '../types.js';

/**
 * TikTok Login Kit (web) + Display API. The Display API exposes profile fields, aggregate counts (with
 * user.info.stats) and public video metadata — NOT reach, impressions, watch time or demographics, so Bloom never
 * shows those for TikTok. open_id is app-scoped. Partially verified 2026-11-10 (developer site returned 503; facts
 * from TikTok's official pages via search) — docs/integrations/tiktok.md lists what to re-check before production.
 */
export interface TikTokConfig {
  clientKey: string;
  clientSecret: string;
  authorizeUrl?: string;
  apiBase?: string;
}

const SCOPES = ['user.info.basic', 'user.info.profile', 'user.info.stats', 'video.list'];
const MAX_PAGES = 5;
/** Documented maximum page size for /v2/video/list/. */
export const VIDEO_PAGE_SIZE = 20;

interface TikTokError {
  error?: { code?: string; message?: string } | string;
  error_description?: string;
}

export function classifyTikTokError(status: number, body: unknown, retryAfter?: number): IntegrationError {
  const b = (body ?? {}) as TikTokError;
  if (typeof b.error === 'string') {
    // OAuth endpoint format: { error, error_description }
    if (b.error === 'invalid_grant') return new IntegrationError('AUTH_INVALID', 'invalid_grant', 'TikTok rejected the refresh token; reconnect TikTok');
    return new IntegrationError('BAD_RESPONSE', `TIKTOK_${b.error}`, b.error_description ?? b.error);
  }
  const code = b.error?.code ?? '';
  const message = b.error?.message || `TikTok returned HTTP ${status}`;
  if (code === 'access_token_invalid' || status === 401) return new IntegrationError('AUTH_INVALID', 'TIKTOK_TOKEN_INVALID', message);
  if (code === 'scope_not_authorized' || code === 'scope_permission_missed') return new IntegrationError('PERMISSION', 'TIKTOK_SCOPE_MISSING', message);
  if (code === 'rate_limit_exceeded' || status === 429) return new IntegrationError('RATE_LIMITED', 'TIKTOK_RATE_LIMITED', message, retryAfter ?? 60);
  return classifyByStatus(status, retryAfter);
}

interface TikTokUser {
  open_id: string;
  union_id?: string;
  avatar_url?: string;
  display_name?: string;
  username?: string;
  follower_count?: number;
  following_count?: number;
  likes_count?: number;
  video_count?: number;
}

interface TikTokVideo {
  id: string;
  title?: string;
  video_description?: string;
  create_time?: number;
  cover_image_url?: string;
  share_url?: string;
  duration?: number;
  view_count?: number;
  like_count?: number;
  comment_count?: number;
  share_count?: number;
}

export class TikTokAdapter implements ProviderAdapter {
  readonly provider = 'tiktok' as const;
  readonly apiVersion = 'v2';
  readonly scopes = SCOPES;
  /** TikTok documents PKCE for desktop/mobile clients, not for the web (confidential) flow. */
  readonly supportsPkce = false;
  private readonly http: HttpClient;
  private readonly api: string;

  constructor(
    private readonly config: TikTokConfig,
    http?: HttpClientOptions,
  ) {
    this.http = new HttpClient(classifyTikTokError, http);
    this.api = config.apiBase ?? 'https://open.tiktokapis.com/v2';
  }

  status(): ProviderStatus {
    const missing = [!this.config.clientKey && 'TIKTOK_CLIENT_KEY', !this.config.clientSecret && 'TIKTOK_CLIENT_SECRET'].filter(
      (x): x is string => Boolean(x),
    );
    return { provider: this.provider, configured: missing.length === 0, scopes: SCOPES, apiVersion: this.apiVersion, missingConfig: missing };
  }

  authorizeUrl({ state, redirectUri }: { state: string; codeChallenge: string; redirectUri: string }): string {
    this.requireConfig();
    const url = new URL(this.config.authorizeUrl ?? 'https://www.tiktok.com/v2/auth/authorize/');
    url.searchParams.set('client_key', this.config.clientKey);
    url.searchParams.set('scope', SCOPES.join(','));
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('redirect_uri', redirectUri);
    url.searchParams.set('state', state);
    return url.toString();
  }

  async exchangeCode({ code, redirectUri }: { code: string; codeVerifier: string; redirectUri: string }): Promise<TokenSet> {
    this.requireConfig();
    const res = await this.http.request<TikTokToken>({
      method: 'POST',
      url: `${this.api}/oauth/token/`,
      form: {
        client_key: this.config.clientKey,
        client_secret: this.config.clientSecret,
        code: decodeURIComponent(code),
        grant_type: 'authorization_code',
        redirect_uri: redirectUri,
      },
    });
    return toTokenSet(res);
  }

  async discoverIdentities(tokens: TokenSet): Promise<Identity[]> {
    const user = await this.userInfo(tokens.accessToken, tokens.scopes);
    return [{
      providerAccountId: user.open_id,
      handle: user.username ?? user.display_name ?? user.open_id,
      displayName: user.display_name ?? null,
      avatarUrl: user.avatar_url ?? null,
      accountType: 'Creator',
      eligible: true,
      metadata: {},
    }];
  }

  capabilitiesFor(granted: string[]): Capability[] {
    const caps: Capability[] = ['TOKEN_REFRESH'];
    if (granted.includes('user.info.basic')) caps.push('PROFILE_READ');
    if (granted.includes('user.info.stats')) caps.push('ACCOUNT_METRICS');
    if (granted.includes('video.list')) caps.push('CONTENT_LIST', 'CONTENT_METRICS');
    return caps; // never AUDIENCE_INSIGHTS: the Display API has no demographics
  }

  /** Refresh tokens rotate: always store the newly returned one. Lifetimes are taken from the response. */
  async refresh({ refreshToken }: { accessToken: string; refreshToken?: string | null }): Promise<TokenSet> {
    if (!refreshToken) throw new IntegrationError('AUTH_INVALID', 'NO_REFRESH_TOKEN', 'No refresh token stored; reconnect TikTok');
    const res = await this.http.request<TikTokToken>({
      method: 'POST',
      url: `${this.api}/oauth/token/`,
      form: { client_key: this.config.clientKey, client_secret: this.config.clientSecret, grant_type: 'refresh_token', refresh_token: refreshToken },
    });
    return toTokenSet(res);
  }

  async revoke({ accessToken }: { accessToken: string }): Promise<RevokeResult> {
    await this.http.request({
      method: 'POST',
      url: `${this.api}/oauth/revoke/`,
      form: { client_key: this.config.clientKey, client_secret: this.config.clientSecret, token: accessToken },
    });
    return { supported: true, revoked: true, note: null };
  }

  async sync(req: SyncRequest): Promise<SyncResult> {
    const today = new Date().toISOString().slice(0, 10);
    const c = new SyncCollector('v2', today);
    c.capabilities = this.capabilitiesFor(req.grantedScopes);
    const user = await this.userInfo(req.accessToken, req.grantedScopes);
    c.profile = { handle: user.username ?? null, displayName: user.display_name ?? null, avatarUrl: user.avatar_url ?? null, accountType: 'Creator' };
    const stats = req.grantedScopes.includes('user.info.stats');
    const unavailable = stats ? 'NOT_SUPPORTED' : 'PERMISSION_MISSING';
    c.stock('tiktok.follower_count', stats ? num(user.follower_count) : null, '/v2/user/info/ follower_count', unavailable);
    c.stock('tiktok.likes_count', stats ? num(user.likes_count) : null, '/v2/user/info/ likes_count', unavailable);
    c.stock('tiktok.video_count', stats ? num(user.video_count) : null, '/v2/user/info/ video_count', unavailable);
    if (req.grantedScopes.includes('video.list')) {
      await c.step('videos', () => this.videos(c, req));
    } else {
      c.warnings.push('video.list was not granted: videos are unavailable.');
    }
    return c.result();
  }

  private requireConfig() {
    const s = this.status();
    if (!s.configured) throw notConfigured('TikTok', s.missingConfig);
  }

  /** Only request fields covered by granted scopes; asking for others fails the whole call. */
  private async userInfo(token: string, scopes: string[]): Promise<TikTokUser> {
    const fields = ['open_id', 'union_id', 'avatar_url', 'display_name'];
    if (scopes.includes('user.info.profile')) fields.push('username');
    if (scopes.includes('user.info.stats')) fields.push('follower_count', 'following_count', 'likes_count', 'video_count');
    const res = await this.http.request<{ data?: { user?: TikTokUser }; error?: { code?: string; message?: string } }>({
      url: `${this.api}/user/info/`,
      query: { fields: fields.join(',') },
      headers: { Authorization: `Bearer ${token}` },
    });
    assertOk(res);
    if (!res.data?.user?.open_id) throw new IntegrationError('BAD_RESPONSE', 'TIKTOK_NO_USER', 'TikTok returned no user');
    return res.data.user;
  }

  /** Cursor = create_time in ms; pages are newest first, up to 20 per page. */
  private async videos(c: SyncCollector, req: SyncRequest) {
    const sinceMs = Date.parse(req.since + 'T00:00:00Z') - 60 * 86_400_000;
    let cursor: number | undefined;
    for (let page = 0; page < MAX_PAGES; page++) {
      const res = await this.http.request<{
        data?: { videos?: TikTokVideo[]; cursor?: number; has_more?: boolean };
        error?: { code?: string; message?: string };
      }>({
        method: 'POST',
        url: `${this.api}/video/list/`,
        query: { fields: 'id,title,video_description,create_time,cover_image_url,share_url,duration,view_count,like_count,comment_count,share_count' },
        headers: { Authorization: `Bearer ${req.accessToken}` },
        json: cursor === undefined ? { max_count: VIDEO_PAGE_SIZE } : { max_count: VIDEO_PAGE_SIZE, cursor },
      });
      assertOk(res);
      const videos = res.data?.videos ?? [];
      for (const v of videos) {
        const source = '/v2/video/list/';
        const stat = (key: string, value?: number) => {
          const n = num(value);
          return { metricKey: key, value: n, availability: n === null ? 'NOT_SUPPORTED' as const : 'AVAILABLE' as const, sourceEndpoint: source, apiVersion: 'v2' };
        };
        c.posts.push({
          providerContentId: v.id,
          contentType: 'VIDEO',
          title: (v.title || v.video_description || null)?.slice(0, 500) ?? null,
          permalink: v.share_url ?? null,
          thumbnailUrl: v.cover_image_url ?? null,
          publishedAt: new Date((v.create_time ?? 0) * 1000).toISOString(),
          durationSeconds: num(v.duration),
          metrics: [
            stat('tiktok.post.view_count', v.view_count),
            stat('tiktok.post.like_count', v.like_count),
            stat('tiktok.post.comment_count', v.comment_count),
            stat('tiktok.post.share_count', v.share_count),
          ],
        });
      }
      const oldest = videos[videos.length - 1]?.create_time;
      if (!res.data?.has_more || res.data.cursor === undefined || (oldest !== undefined && oldest * 1000 < sinceMs)) return;
      cursor = res.data.cursor;
    }
    c.markIncomplete(`Stopped after ${MAX_PAGES} pages of videos; older videos are not synced.`);
  }
}

interface TikTokToken {
  access_token: string;
  expires_in?: number;
  open_id?: string;
  refresh_token?: string;
  refresh_expires_in?: number;
  scope?: string;
  token_type?: string;
}

function toTokenSet(t: TikTokToken): TokenSet {
  return {
    accessToken: t.access_token,
    refreshToken: t.refresh_token ?? null,
    tokenType: t.token_type ?? 'Bearer',
    scopes: (t.scope ?? '').split(',').map((s) => s.trim()).filter(Boolean),
    expiresInSeconds: t.expires_in ?? null,
    refreshExpiresInSeconds: t.refresh_expires_in ?? null,
  };
}

/** TikTok can return HTTP 200 with a non-"ok" error code in the body. */
function assertOk(res: { error?: { code?: string; message?: string } }) {
  const code = res.error?.code;
  if (code && code !== 'ok') throw classifyTikTokError(200, res);
}
