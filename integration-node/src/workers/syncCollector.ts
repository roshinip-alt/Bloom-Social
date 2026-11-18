import { IntegrationError } from '../shared/errors.js';
import type {
  Availability,
  Capability,
  MetricPoint,
  PostData,
  ProfileData,
  SyncResult,
  TimeWindow,
} from '../providers/types.js';

/**
 * Accumulates one sync's normalized output. Each provider call runs as a named step:
 * <ul>
 *   <li>AUTH_INVALID aborts the whole sync — the token is unusable and the owner must reconnect.</li>
 *   <li>PERMISSION records a warning and continues (e.g. insights scope not granted).</li>
 *   <li>Any other failure records a warning and marks the result incomplete, so Java stores what was fetched
 *   and labels the run PARTIAL instead of discarding good data.</li>
 * </ul>
 */
export class SyncCollector {
  readonly metrics: MetricPoint[] = [];
  readonly posts: PostData[] = [];
  readonly warnings: string[] = [];
  profile: ProfileData | null = null;
  capabilities: Capability[] | null = null;
  nextCursor: Record<string, unknown> = {};
  private complete = true;

  constructor(
    private readonly apiVersion: string | null,
    private readonly fetchedOn: string,
  ) {}

  async step<T>(name: string, fn: () => Promise<T>): Promise<T | undefined> {
    try {
      return await fn();
    } catch (e) {
      if (e instanceof IntegrationError && e.category === 'AUTH_INVALID') throw e;
      if (e instanceof IntegrationError && e.category === 'RATE_LIMITED' && this.isEmpty()) throw e;
      const message = e instanceof Error ? e.message : String(e);
      this.warnings.push(`${name}: ${message}`);
      if (!(e instanceof IntegrationError && e.category === 'PERMISSION')) this.complete = false;
      return undefined;
    }
  }

  /** A point-in-time (stock) value observed now, e.g. followers. */
  stock(metricKey: string, value: number | null | undefined, sourceEndpoint: string, unavailable: Availability = 'NOT_SUPPORTED') {
    this.metric(metricKey, this.fetchedOn, 'DAY', {}, value, sourceEndpoint, unavailable);
  }

  metric(
    metricKey: string,
    date: string,
    timeWindow: TimeWindow,
    dimensions: Record<string, string>,
    value: number | null | undefined,
    sourceEndpoint: string,
    unavailable: Availability = 'NOT_SUPPORTED',
  ) {
    const ok = typeof value === 'number' && Number.isFinite(value);
    this.metrics.push({
      metricKey,
      date,
      timeWindow,
      dimensions,
      value: ok ? value : null,
      availability: ok ? 'AVAILABLE' : unavailable,
      sourceEndpoint,
      apiVersion: this.apiVersion,
    });
  }

  markIncomplete(warning: string) {
    this.complete = false;
    this.warnings.push(warning);
  }

  result(): SyncResult {
    return {
      profile: this.profile,
      capabilities: this.capabilities,
      accountMetrics: this.metrics,
      posts: this.posts,
      nextCursor: this.nextCursor,
      complete: this.complete,
      warnings: this.warnings,
    };
  }

  private isEmpty() {
    return this.metrics.length === 0 && this.posts.length === 0 && this.profile === null;
  }
}

/** Converts a value from a provider payload to a finite number, or null. */
export function num(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '' && Number.isFinite(Number(value))) return Number(value);
  return null;
}

export function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function addDays(date: string, days: number): string {
  const d = new Date(date + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + days);
  return isoDate(d);
}

export function daysBetween(from: string, to: string): string[] {
  const out: string[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(d);
  return out;
}
