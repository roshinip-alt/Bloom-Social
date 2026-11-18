import type { Env } from '../config/env.js';
import { IntegrationError } from '../shared/errors.js';
import type { HttpClientOptions } from '../shared/http.js';
import { InstagramAdapter } from './instagram/instagramAdapter.js';
import { TikTokAdapter } from './tiktok/tiktokAdapter.js';
import type { ProviderAdapter, ProviderCode } from './types.js';
import { YouTubeAdapter } from './youtube/youtubeAdapter.js';

/** Resolves adapters by provider code. Adding a provider (e.g. Facebook Pages later) means registering it here. */
export class ProviderRegistry {
  private readonly adapters: Map<ProviderCode, ProviderAdapter>;

  constructor(adapters: ProviderAdapter[]) {
    this.adapters = new Map(adapters.map((a) => [a.provider, a]));
  }

  static fromEnv(env: Env, http?: HttpClientOptions): ProviderRegistry {
    const options = { timeoutMs: env.HTTP_TIMEOUT_MS, ...http };
    return new ProviderRegistry([
      new InstagramAdapter({ appId: env.INSTAGRAM_APP_ID, appSecret: env.INSTAGRAM_APP_SECRET, apiVersion: env.INSTAGRAM_GRAPH_API_VERSION }, options),
      new YouTubeAdapter({ clientId: env.GOOGLE_CLIENT_ID, clientSecret: env.GOOGLE_CLIENT_SECRET }, options),
      new TikTokAdapter({ clientKey: env.TIKTOK_CLIENT_KEY, clientSecret: env.TIKTOK_CLIENT_SECRET }, options),
    ]);
  }

  get(code: string): ProviderAdapter {
    const adapter = this.adapters.get(code.toLowerCase() as ProviderCode);
    if (!adapter) throw new IntegrationError('BAD_RESPONSE', 'UNKNOWN_PROVIDER', `Unknown provider '${code}'`);
    return adapter;
  }

  all(): ProviderAdapter[] {
    return [...this.adapters.values()];
  }
}
