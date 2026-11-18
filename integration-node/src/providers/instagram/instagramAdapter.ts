import { IntegrationError, notConfigured } from '../../shared/errors.js';
import { HttpClient, classifyByStatus, type HttpClientOptions } from '../../shared/http.js';
import { SyncCollector, addDays, num } from '../../workers/syncCollector.js';
import type {
  Capability,
  Identity,
  PostData,
  PostType,
  ProviderAdapter,
  ProviderStatus,
  RevokeResult,
  SyncRequest,
  SyncResult,
  TokenSet,
} from '../types.js';

/**
 * Instagram API with Instagram Login (professional accounts only). Facts checked 2026-11-10 — see
 * docs/integrations/instagram.md. Chosen over Facebook Login: no Facebook Page is required and the permission
 * model (instagram_business_*) is not mixed with Page permissions. No PKCE is documented for this flow, so the
 * code exchange relies on the confidential client secret (server-side only).
 */
export interface InstagramConfig {
  appId: string;
  appSecret: string;
  apiVersion: string;
  authorizeBase?: string;
  tokenUrl?: string;
  graphBase?: string;
}

const SCOPES = ['instagram_business_basic', 'instagram_business_manage_insights'];
const ACCOUNT_DAY_METRICS: Record<string, string> = {
  reach: 'instagram.reach',
  views: 'instagram.views',
  accounts_engaged: 'instagram.accounts_engaged',
  total_interactions: 'instagram.total_interactions',
  likes: 'instagram.likes',
  comments: 'instagram.comments',
  shares: 'instagram.shares',
  saves: 'instagram.saves',
};
const POST_METRICS: Record<string, string> = {
  reach: 'instagram.post.reach',
  views: 'instagram.post.views',
  likes: 'instagram.post.likes',
  comments: 'instagram.post.comments',
  saved: 'instagram.post.saved',
  shares: 'instagram.post.shares',
};
const STORY_METRICS = ['reach', 'views', 'shares'];
const ELIGIBLE_TYPES = new Set(['BUSINESS', 'MEDIA_CREATOR', 'CREATOR']);
/** Account insights are fetched one day per request; cap the backfill to protect the hourly rate limit. */
export const MAX_INSIGHT_DAYS = 30;
const MAX_MEDIA = 100;

interface GraphError {
  error?: { message?: string; code?: number; error_subcode?: number; type?: string };
  error_type?: string;
  error_message?: string;
  code?: number;
}

export function classifyGraphError(status: number, body: unknown, retryAfter?: number): IntegrationError {
  const b = (body ?? {}) as GraphError;
  const code = b.error?.code ?? b.code;
  const message = b.error?.message ?? b.error_message ?? `Instagram returned HTTP ${status}`;
  if (code === 190 || status === 401) return new IntegrationError('AUTH_INVALID', 'IG_TOKEN_INVALID', message);
  if (code !== undefined && [4, 17, 32, 613].includes(code)) {
    return new IntegrationError('RATE_LIMITED', 'IG_RATE_LIMITED', message, retryAfter ?? 600);
  }
  if (code === 10 || (code !== undefined && code >= 200 && code < 300)) {
    return new IntegrationError('PERMISSION', `IG_PERMISSION_${code}`, message);
  }
  if (code === 1 || code === 2) return new IntegrationError('TRANSIENT', 'IG_TEMPORARY', message, retryAfter);
  if (b.error_type === 'OAuthException' && status === 400) return new IntegrationError('BAD_RESPONSE', 'IG_OAUTH_ERROR', message);
  return classifyByStatus(status, retryAfter);
}

interface MediaItem {
  id: string;
  caption?: string;
  media_type?: string;
  media_product_type?: string;
  permalink?: string;
  thumbnail_url?: string;
  media_url?: string;
  timestamp: string;
}

export class InstagramAdapter implements ProviderAdapter {
  readonly provider = 'instagram' as const;
  readonly scopes = SCOPES;
  readonly supportsPkce = false;
  readonly apiVersion: string;
  private readonly http: HttpClient;
  private readonly graph: string;

  constructor(
    private readonly config: InstagramConfig,
    http?: HttpClientOptions,
  ) {
    this.apiVersion = config.apiVersion;
    this.http = new HttpClient(classifyGraphError, http);
    this.graph = `${config.graphBase ?? 'https://graph.instagram.com'}/${config.apiVersion}`;
  }

  status(): ProviderStatus {
    const missing = [!this.config.appId && 'INSTAGRAM_APP_ID', !this.config.appSecret && 'INSTAGRAM_APP_SECRET'].filter(
      (x): x is string => Boolean(x),
    );
    return { provider: this.provider, configured: missing.length === 0, scopes: SCOPES, apiVersion: this.apiVersion, missingConfig: missing };
  }

  authorizeUrl({ state, redirectUri }: { state: string; codeChallenge: string; redirectUri: string }): string {
    this.requireConfig();
    const url = new URL(this.config.authorizeBase ?? 'https://www.instagram.com/oauth/authorize');
    url.searchParams.set('client_id', this.config.appId);
    url.searchParams.set('redirect_uri', redirectUri);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('scope', SCOPES.join(','));
    url.searchParams.set('state', state);
    return url.toString();
  }

  async exchangeCode({ code, redirectUri }: { code: string; codeVerifier: string; redirectUri: string }): Promise<TokenSet> {
    this.requireConfig();
    // Instagram appends "#_" to the redirect; strip it defensively in case it reaches us.
    const cleanCode = code.replace(/#_$/, '');
    const short = await this.http.request<{ data?: ShortToken[] } & ShortToken>({
      method: 'POST',
      url: this.config.tokenUrl ?? 'https://api.instagram.com/oauth/access_token',
      form: {
        client_id: this.config.appId,
        client_secret: this.config.appSecret,
        grant_type: 'authorization_code',
        redirect_uri: redirectUri,
        code: cleanCode,
      },
    });
    const first = short.data?.[0] ?? short;
    if (!first.access_token) throw new IntegrationError('BAD_RESPONSE', 'IG_NO_TOKEN', 'Instagram returned no access token');
    const scopes = (first.permissions ?? '').split(',').map((s) => s.trim()).filter(Boolean);
    // Exchange the 1-hour token for a 60-day long-lived token (server-side only).
    const long = await this.http.request<{ access_token: string; token_type?: string; expires_in?: number }>({
      url: `${this.config.graphBase ?? 'https://graph.instagram.com'}/access_token`,
      query: { grant_type: 'ig_exchange_token', client_secret: this.config.appSecret, access_token: first.access_token },
    });
    return {
      accessToken: long.access_token,
      refreshToken: null,
      tokenType: long.token_type ?? 'bearer',
      scopes: scopes.length > 0 ? scopes : SCOPES,
      expiresInSeconds: long.expires_in ?? null,
      refreshExpiresInSeconds: null,
    };
  }

  async discoverIdentities(tokens: TokenSet): Promise<Identity[]> {
    const me = await this.profile(tokens.accessToken);
    const type = (me.account_type ?? '').toUpperCase();
    const eligible = ELIGIBLE_TYPES.has(type);
    return [
      {
        providerAccountId: me.user_id ?? me.id,
        handle: me.username,
        displayName: me.name ?? me.username,
        avatarUrl: me.profile_picture_url ?? null,
        accountType: me.account_type ?? null,
        eligible,
        ineligibleReason: eligible
          ? null
          : 'Instagram only allows Business or Creator (professional) accounts to share insights. Switch the account to professional in the Instagram app, then connect again.',
        metadata: {},
      },
    ];
  }

  capabilitiesFor(granted: string[]): Capability[] {
    const caps: Capability[] = ['TOKEN_REFRESH'];
    if (granted.includes('instagram_business_basic')) caps.push('PROFILE_READ', 'CONTENT_LIST');
    if (granted.includes('instagram_business_manage_insights')) caps.push('ACCOUNT_METRICS', 'CONTENT_METRICS', 'AUDIENCE_INSIGHTS');
    return caps;
  }

  /** Long-lived tokens refresh themselves (token must be ≥24 h old and unexpired); there is no refresh token. */
  async refresh({ accessToken }: { accessToken: string }): Promise<TokenSet> {
    const res = await this.http.request<{ access_token: string; token_type?: string; expires_in?: number }>({
      url: `${this.config.graphBase ?? 'https://graph.instagram.com'}/refresh_access_token`,
      query: { grant_type: 'ig_refresh_token', access_token: accessToken },
    });
    return { accessToken: res.access_token, tokenType: res.token_type ?? 'bearer', scopes: [], expiresInSeconds: res.expires_in ?? null };
  }

  async revoke(): Promise<RevokeResult> {
    return {
      supported: false,
      revoked: false,
      note: 'Instagram Login has no token revocation endpoint. Bloom deleted its stored token; you can also remove Bloom under Instagram → Settings → Apps and websites.',
    };
  }

  async sync(req: SyncRequest): Promise<SyncResult> {
    const today = new Date().toISOString().slice(0, 10);
    const c = new SyncCollector(this.apiVersion, today);
    const token = req.accessToken;
    const id = req.providerAccountId;
    const hasInsights = req.grantedScopes.includes('instagram_business_manage_insights');
    c.capabilities = this.capabilitiesFor(req.grantedScopes);

    const me = await this.profile(token);
    c.profile = { handle: me.username, displayName: me.name ?? me.username, avatarUrl: me.profile_picture_url ?? null, accountType: me.account_type ?? null };
    c.stock('instagram.followers_count', num(me.followers_count), 'GET /me followers_count');
    c.stock('instagram.media_count', num(me.media_count), 'GET /me media_count');

    if (hasInsights) {
      await this.accountInsights(c, id, token, req);
      await c.step('follower demographics', () => this.demographics(c, id, token, today));
    } else {
      c.warnings.push('Insights permission not granted: reach, views, interactions and demographics are unavailable.');
    }
    await c.step('media', () => this.media(c, id, token, req, hasInsights));
    return c.result();
  }

  // ------------------------------------------------------------------ helpers

  private requireConfig() {
    const s = this.status();
    if (!s.configured) throw notConfigured('Instagram', s.missingConfig);
  }

  private profile(token: string) {
    return this.http.request<Profile>({
      url: `${this.graph}/me`,
      query: { fields: 'user_id,username,name,account_type,profile_picture_url,followers_count,media_count', access_token: token },
    });
  }

  private async accountInsights(c: SyncCollector, id: string, token: string, req: SyncRequest) {
    const earliest = addDays(req.until, -(MAX_INSIGHT_DAYS - 1));
    const from = req.since > earliest ? req.since : earliest;
    if (from > req.since) {
      c.warnings.push(`Account insights were fetched for the latest ${MAX_INSIGHT_DAYS} days only, to respect Instagram rate limits.`);
    }
    for (let day = from; day <= req.until; day = addDays(day, 1)) {
      const since = Date.parse(day + 'T00:00:00Z') / 1000;
      await c.step(`insights ${day}`, async () => {
        const res = await this.http.request<{ data?: { name: string; total_value?: { value?: number } }[] }>({
          url: `${this.graph}/${id}/insights`,
          query: {
            metric: Object.keys(ACCOUNT_DAY_METRICS).join(','),
            period: 'day',
            metric_type: 'total_value',
            since,
            until: since + 86_400,
            access_token: token,
          },
        });
        for (const item of res.data ?? []) {
          const key = ACCOUNT_DAY_METRICS[item.name];
          if (key) c.metric(key, day, 'DAY', {}, num(item.total_value?.value), 'GET /{ig-id}/insights period=day', 'NOT_ENOUGH_DATA');
        }
      });
    }
  }

  private async demographics(c: SyncCollector, id: string, token: string, today: string) {
    for (const breakdown of ['age', 'gender', 'country', 'city']) {
      try {
        const res = await this.http.request<{
          data?: { total_value?: { breakdowns?: { results?: { dimension_values: string[]; value: number }[] }[] } }[];
        }>({
          url: `${this.graph}/${id}/insights`,
          query: {
            metric: 'follower_demographics',
            period: 'lifetime',
            metric_type: 'total_value',
            timeframe: 'this_month',
            breakdown,
            access_token: token,
          },
        });
        const results = res.data?.[0]?.total_value?.breakdowns?.[0]?.results ?? [];
        if (results.length === 0) {
          // Meta returns an empty set (not zero) under 100 followers.
          c.metric('instagram.follower_demographics', today, 'LIFETIME', { [breakdown]: '_unavailable' }, null,
            'GET /{ig-id}/insights follower_demographics', 'NOT_ENOUGH_DATA');
          continue;
        }
        for (const r of results) {
          const bucket = r.dimension_values[0];
          if (bucket) {
            c.metric('instagram.follower_demographics', today, 'LIFETIME', { [breakdown]: bucket }, num(r.value),
              'GET /{ig-id}/insights follower_demographics');
          }
        }
      } catch (e) {
        if (e instanceof IntegrationError && e.category === 'PERMISSION') {
          c.metric('instagram.follower_demographics', today, 'LIFETIME', { [breakdown]: '_unavailable' }, null,
            'GET /{ig-id}/insights follower_demographics', 'NOT_ENOUGH_DATA');
          continue;
        }
        throw e;
      }
    }
  }

  private async media(c: SyncCollector, id: string, token: string, req: SyncRequest, withInsights: boolean) {
    let next: string | undefined = `${this.graph}/${id}/media`;
    let query: Record<string, string> | undefined = {
      fields: 'id,caption,media_type,media_product_type,permalink,thumbnail_url,media_url,timestamp',
      limit: '50',
      access_token: token,
    };
    const items: MediaItem[] = [];
    while (next && items.length < MAX_MEDIA) {
      const page: { data?: MediaItem[]; paging?: { next?: string } } = await this.http.request({ url: next, query });
      items.push(...(page.data ?? []));
      const oldest = page.data?.[page.data.length - 1]?.timestamp;
      // The paging.next URL already carries the cursor and parameters.
      next = oldest && oldest.slice(0, 10) >= addDays(req.since, -60) ? page.paging?.next : undefined;
      query = undefined;
    }
    for (const m of items.slice(0, MAX_MEDIA)) {
      const post: PostData = {
        providerContentId: m.id,
        contentType: postType(m),
        title: m.caption ? m.caption.slice(0, 500) : null,
        permalink: m.permalink ?? null,
        thumbnailUrl: m.thumbnail_url ?? (m.media_type === 'IMAGE' ? m.media_url ?? null : null),
        publishedAt: new Date(m.timestamp).toISOString(),
        durationSeconds: null,
        metrics: [],
      };
      if (withInsights) {
        await c.step(`media insights ${m.id}`, () => this.mediaInsights(post, m, token));
      }
      c.posts.push(post);
    }
  }

  private async mediaInsights(post: PostData, m: MediaItem, token: string) {
    const isStory = m.media_product_type === 'STORY';
    const names = isStory ? STORY_METRICS : Object.keys(POST_METRICS);
    const source = 'GET /{ig-media-id}/insights';
    try {
      const res = await this.http.request<{ data?: { name: string; values?: { value: number }[]; total_value?: { value: number } }[] }>({
        url: `${this.graph}/${m.id}/insights`,
        query: { metric: names.join(','), access_token: token },
      });
      const byName = new Map((res.data ?? []).map((d) => [d.name, num(d.total_value?.value ?? d.values?.[0]?.value)]));
      for (const [name, key] of Object.entries(POST_METRICS)) {
        if (!names.includes(name)) {
          post.metrics.push({ metricKey: key, value: null, availability: 'NOT_SUPPORTED', sourceEndpoint: source, apiVersion: this.apiVersion });
          continue;
        }
        const value = byName.get(name) ?? null;
        post.metrics.push({ metricKey: key, value, availability: value === null ? 'NOT_ENOUGH_DATA' : 'AVAILABLE', sourceEndpoint: source, apiVersion: this.apiVersion });
      }
    } catch (e) {
      // (#10) "Not enough viewers": Meta withholds small-audience media insights; carousel children have none.
      if (e instanceof IntegrationError && e.category === 'PERMISSION') {
        for (const key of Object.values(POST_METRICS)) {
          post.metrics.push({ metricKey: key, value: null, availability: 'NOT_ENOUGH_DATA', sourceEndpoint: source, apiVersion: this.apiVersion });
        }
        return;
      }
      throw e;
    }
  }
}

interface ShortToken {
  access_token?: string;
  user_id?: string | number;
  permissions?: string;
}

interface Profile {
  id: string;
  user_id?: string;
  username: string;
  name?: string;
  account_type?: string;
  profile_picture_url?: string;
  followers_count?: number;
  media_count?: number;
}

function postType(m: MediaItem): PostType {
  if (m.media_product_type === 'REELS') return 'REEL';
  if (m.media_product_type === 'STORY') return 'STORY';
  if (m.media_type === 'CAROUSEL_ALBUM') return 'CAROUSEL';
  if (m.media_type === 'VIDEO') return 'VIDEO';
  return 'IMAGE';
}
