import { IntegrationError } from './errors.js';
import type { FetchLike } from './http.js';
import type { Identity, ProviderCode, TokenSet } from '../providers/types.js';

export interface ResolvedSession {
  sessionId: string;
  codeVerifier: string;
  redirectUri: string;
}

export interface SessionOutcome {
  sessionId: string;
  status: string;
  returnPath: string;
}

/** Client for the Java backend's /internal/v1 endpoints (service-to-service, shared token). */
export class BloomApi {
  constructor(
    private readonly baseUrl: string,
    private readonly internalToken: string,
    private readonly fetchImpl: FetchLike = (i, init) => fetch(i, init),
  ) {}

  resolveSession(provider: ProviderCode, state: string, correlationId?: string): Promise<ResolvedSession> {
    return this.post('/internal/v1/oauth/sessions/resolve', { provider, state }, correlationId);
  }

  completeSession(
    sessionId: string,
    body: { tokens: TokenSet; identities: Identity[]; capabilities: string[] },
    correlationId?: string,
  ): Promise<SessionOutcome> {
    return this.post(`/internal/v1/oauth/sessions/${encodeURIComponent(sessionId)}/complete`, body, correlationId);
  }

  failSession(sessionId: string, errorCode: string, errorMessage: string, correlationId?: string): Promise<SessionOutcome> {
    return this.post(
      `/internal/v1/oauth/sessions/${encodeURIComponent(sessionId)}/fail`,
      { provider: 'n/a', state: 'n/a', errorCode, errorMessage },
      correlationId,
    );
  }

  failByState(provider: ProviderCode, state: string, errorCode: string, errorMessage: string, correlationId?: string) {
    return this.post<SessionOutcome>('/internal/v1/oauth/sessions/fail', { provider, state, errorCode, errorMessage }, correlationId);
  }

  accountDeauthorized(provider: string, providerAccountId: string): Promise<{ matched: boolean }> {
    return this.post('/internal/v1/accounts/deauthorized', { provider, providerAccountId });
  }

  accountDataDeletion(provider: string, providerAccountId: string): Promise<{ matched: boolean }> {
    return this.post('/internal/v1/accounts/data-deletion', { provider, providerAccountId });
  }

  private async post<T>(path: string, body: unknown, correlationId?: string): Promise<T> {
    let res: Response;
    try {
      res = await this.fetchImpl(this.baseUrl.replace(/\/$/, '') + path, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Internal-Token': this.internalToken,
          ...(correlationId ? { 'X-Correlation-Id': correlationId } : {}),
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(10_000),
      });
    } catch {
      throw new IntegrationError('UNREACHABLE', 'BACKEND_UNREACHABLE', 'The Bloom backend could not be reached');
    }
    const text = await res.text();
    const parsed = text ? (JSON.parse(text) as { code?: string; message?: string }) : {};
    if (!res.ok) {
      throw new IntegrationError('BAD_RESPONSE', parsed.code ?? `BACKEND_${res.status}`, parsed.message ?? 'Backend rejected the request');
    }
    return parsed as T;
  }
}
