/**
 * Java ↔ Node wire contract (mirrors com.bloom.social.gateway.GatewayDtos) and the provider adapter interface.
 * Dates are ISO yyyy-MM-dd, instants ISO-8601 UTC. A null metric value always comes with a non-AVAILABLE
 * availability — it is never a stand-in for zero.
 */
export type ProviderCode = 'instagram' | 'youtube' | 'tiktok';

export type Capability =
  | 'PROFILE_READ'
  | 'ACCOUNT_METRICS'
  | 'CONTENT_LIST'
  | 'CONTENT_METRICS'
  | 'AUDIENCE_INSIGHTS'
  | 'PUBLISHING'
  | 'TOKEN_REFRESH';

export type Availability = 'AVAILABLE' | 'NOT_SUPPORTED' | 'PERMISSION_MISSING' | 'NOT_ENOUGH_DATA' | 'DELAYED';

export type TimeWindow = 'DAY' | 'LIFETIME' | 'PERIOD_28D';

export interface TokenSet {
  accessToken: string;
  refreshToken?: string | null;
  tokenType?: string | null;
  scopes: string[];
  expiresInSeconds?: number | null;
  refreshExpiresInSeconds?: number | null;
}

export interface Identity {
  providerAccountId: string;
  handle: string;
  displayName?: string | null;
  avatarUrl?: string | null;
  accountType?: string | null;
  eligible: boolean;
  ineligibleReason?: string | null;
  metadata?: Record<string, string>;
}

export interface SyncRequest {
  accountId: string;
  providerAccountId: string;
  accessToken: string;
  grantedScopes: string[];
  cursor: Record<string, unknown> | null;
  since: string;
  until: string;
}

export interface MetricPoint {
  metricKey: string;
  date: string;
  timeWindow: TimeWindow;
  dimensions: Record<string, string>;
  value: number | null;
  availability: Availability;
  sourceEndpoint: string;
  apiVersion: string | null;
}

export interface PostMetric {
  metricKey: string;
  value: number | null;
  availability: Availability;
  sourceEndpoint: string;
  apiVersion: string | null;
}

export type PostType = 'IMAGE' | 'VIDEO' | 'CAROUSEL' | 'REEL' | 'STORY' | 'SHORT';

export interface PostData {
  providerContentId: string;
  contentType: PostType;
  title: string | null;
  permalink: string | null;
  thumbnailUrl: string | null;
  publishedAt: string;
  durationSeconds: number | null;
  metrics: PostMetric[];
}

export interface ProfileData {
  handle?: string | null;
  displayName?: string | null;
  avatarUrl?: string | null;
  accountType?: string | null;
}

export interface SyncResult {
  profile: ProfileData | null;
  capabilities: Capability[] | null;
  accountMetrics: MetricPoint[];
  posts: PostData[];
  nextCursor: Record<string, unknown>;
  complete: boolean;
  warnings: string[];
}

export interface RevokeResult {
  supported: boolean;
  revoked: boolean;
  note: string | null;
}

export interface ScopeInfo {
  scope: string;
  purpose: string;
}

export interface ProviderStatus {
  provider: ProviderCode;
  configured: boolean;
  scopes: string[];
  apiVersion: string;
  missingConfig: string[];
}

/** Everything Bloom needs from one social platform. Each adapter only uses official, documented endpoints. */
export interface ProviderAdapter {
  readonly provider: ProviderCode;
  readonly apiVersion: string;
  /** Scopes requested at authorization — least privilege, read-only. */
  readonly scopes: string[];
  /** Whether the provider documents PKCE for this (web, confidential-client) flow. */
  readonly supportsPkce: boolean;

  status(): ProviderStatus;
  authorizeUrl(params: { state: string; codeChallenge: string; redirectUri: string }): string;
  exchangeCode(params: { code: string; codeVerifier: string; redirectUri: string }): Promise<TokenSet>;
  discoverIdentities(tokens: TokenSet): Promise<Identity[]>;
  /** Capabilities actually usable given the scopes the owner granted. */
  capabilitiesFor(grantedScopes: string[]): Capability[];
  refresh(params: { accessToken: string; refreshToken?: string | null }): Promise<TokenSet>;
  revoke(params: { accessToken: string; refreshToken?: string | null }): Promise<RevokeResult>;
  sync(request: SyncRequest): Promise<SyncResult>;
}
