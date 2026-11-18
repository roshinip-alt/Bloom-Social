import { IntegrationError } from './errors.js';

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export interface HttpRequest {
  method?: 'GET' | 'POST';
  url: string;
  query?: Record<string, string | number | undefined>;
  form?: Record<string, string | undefined>;
  json?: unknown;
  headers?: Record<string, string>;
}

/** Converts a non-2xx provider response into a categorised error. Each provider supplies its own. */
export type ErrorClassifier = (status: number, body: unknown, retryAfterSeconds?: number) => IntegrationError;

export interface HttpClientOptions {
  fetch?: FetchLike;
  timeoutMs?: number;
  /** Total attempts for retryable failures (1 = no retry). */
  maxAttempts?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  /** Retry-After values above this are not waited for in-process; the error is returned so Java can reschedule. */
  maxInlineRetryAfterMs?: number;
  sleep?: (ms: number) => Promise<void>;
  random?: () => number;
}

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Small HTTP client for provider APIs: per-request timeout, bounded exponential backoff with full jitter for
 * retryable failures, and Retry-After support. Non-retryable failures (auth, permission) surface immediately.
 */
export class HttpClient {
  private readonly fetchImpl: FetchLike;
  private readonly opts: Required<Omit<HttpClientOptions, 'fetch'>>;

  constructor(
    private readonly classify: ErrorClassifier,
    options: HttpClientOptions = {},
  ) {
    this.fetchImpl = options.fetch ?? ((input, init) => fetch(input, init));
    this.opts = {
      timeoutMs: options.timeoutMs ?? 15_000,
      maxAttempts: options.maxAttempts ?? 3,
      baseDelayMs: options.baseDelayMs ?? 500,
      maxDelayMs: options.maxDelayMs ?? 8_000,
      maxInlineRetryAfterMs: options.maxInlineRetryAfterMs ?? 10_000,
      sleep: options.sleep ?? defaultSleep,
      random: options.random ?? Math.random,
    };
  }

  async request<T>(req: HttpRequest): Promise<T> {
    let lastError: IntegrationError | undefined;
    for (let attempt = 1; attempt <= this.opts.maxAttempts; attempt++) {
      try {
        return await this.once<T>(req);
      } catch (e) {
        const err = e instanceof IntegrationError ? e : new IntegrationError('TRANSIENT', 'HTTP_FAILED', String(e));
        lastError = err;
        if (!err.retryable || attempt === this.opts.maxAttempts) throw err;
        const retryAfterMs = (err.retryAfterSeconds ?? 0) * 1000;
        if (retryAfterMs > this.opts.maxInlineRetryAfterMs) throw err;
        await this.opts.sleep(Math.max(retryAfterMs, this.backoff(attempt)));
      }
    }
    throw lastError ?? new IntegrationError('TRANSIENT', 'HTTP_FAILED', 'Request failed');
  }

  /** Full-jitter exponential backoff: random(0, min(max, base·2^(attempt-1))). */
  backoff(attempt: number): number {
    const cap = Math.min(this.opts.maxDelayMs, this.opts.baseDelayMs * 2 ** (attempt - 1));
    return Math.floor(this.opts.random() * cap);
  }

  private async once<T>(req: HttpRequest): Promise<T> {
    const url = new URL(req.url);
    for (const [k, v] of Object.entries(req.query ?? {})) {
      if (v !== undefined) url.searchParams.set(k, String(v));
    }
    const headers: Record<string, string> = { Accept: 'application/json', ...req.headers };
    let body: string | undefined;
    if (req.form) {
      headers['Content-Type'] = 'application/x-www-form-urlencoded';
      body = new URLSearchParams(
        Object.entries(req.form).filter((e): e is [string, string] => e[1] !== undefined),
      ).toString();
    } else if (req.json !== undefined) {
      headers['Content-Type'] = 'application/json';
      body = JSON.stringify(req.json);
    }

    let res: Response;
    try {
      res = await this.fetchImpl(url.toString(), {
        method: req.method ?? 'GET',
        headers,
        body,
        signal: AbortSignal.timeout(this.opts.timeoutMs),
      });
    } catch (e) {
      const timedOut = e instanceof Error && (e.name === 'TimeoutError' || e.name === 'AbortError');
      throw new IntegrationError(
        timedOut ? 'TRANSIENT' : 'UNREACHABLE',
        timedOut ? 'PROVIDER_TIMEOUT' : 'PROVIDER_UNREACHABLE',
        timedOut ? 'The provider did not respond in time' : 'The provider could not be reached',
      );
    }

    const text = await res.text();
    let parsed: unknown = undefined;
    if (text) {
      try {
        parsed = JSON.parse(text);
      } catch {
        parsed = text;
      }
    }
    if (!res.ok) {
      throw this.classify(res.status, parsed, parseRetryAfter(res.headers.get('retry-after')));
    }
    return parsed as T;
  }
}

/** Retry-After is either delta-seconds or an HTTP date. */
export function parseRetryAfter(value: string | null, now = Date.now()): number | undefined {
  if (!value) return undefined;
  const seconds = Number(value);
  if (Number.isFinite(seconds)) return Math.max(0, Math.ceil(seconds));
  const date = Date.parse(value);
  return Number.isNaN(date) ? undefined : Math.max(0, Math.ceil((date - now) / 1000));
}

/** Fallback classification by HTTP status for providers without a richer error body. */
export function classifyByStatus(status: number, retryAfterSeconds?: number): IntegrationError {
  if (status === 401) return new IntegrationError('AUTH_INVALID', 'UNAUTHORIZED', 'The provider rejected the access token');
  if (status === 403) return new IntegrationError('PERMISSION', 'FORBIDDEN', 'The provider denied access to this resource');
  if (status === 429) {
    return new IntegrationError('RATE_LIMITED', 'RATE_LIMITED', 'The provider rate limit was reached', retryAfterSeconds);
  }
  if (status >= 500) return new IntegrationError('TRANSIENT', `PROVIDER_${status}`, 'The provider had a temporary error', retryAfterSeconds);
  return new IntegrationError('BAD_RESPONSE', `PROVIDER_${status}`, `The provider returned HTTP ${status}`);
}
