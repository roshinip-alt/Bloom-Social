import { describe, expect, it, vi } from 'vitest';
import type { IntegrationError } from '../src/shared/errors.js';
import { HttpClient, classifyByStatus, parseRetryAfter } from '../src/shared/http.js';
import { FakeFetch } from './fakeFetch.js';

const classify = (status: number, _body: unknown, retryAfter?: number) => classifyByStatus(status, retryAfter);

describe('HttpClient', () => {
  it('retries transient failures with bounded backoff, then succeeds', async () => {
    const fake = new FakeFetch().once('GET api.test/x', { status: 503 }).once('GET api.test/x', { status: 502 }).on('GET api.test/x', { body: { ok: 1 } });
    const sleep = vi.fn(async () => {});
    const client = new HttpClient(classify, { fetch: fake.fetch, sleep, random: () => 1, baseDelayMs: 100, maxDelayMs: 150 });
    await expect(client.request({ url: 'https://api.test/x' })).resolves.toEqual({ ok: 1 });
    expect(fake.calls).toHaveLength(3);
    // full jitter is capped by maxDelayMs
    expect(sleep.mock.calls.map((c) => (c as unknown as number[])[0])).toEqual([100, 150]);
  });

  it('honours Retry-After when it is longer than the backoff', async () => {
    const fake = new FakeFetch().once('GET api.test/x', { status: 429, headers: { 'retry-after': '3' } }).on('GET api.test/x', { body: {} });
    const sleep = vi.fn(async () => {});
    await new HttpClient(classify, { fetch: fake.fetch, sleep, random: () => 0 }).request({ url: 'https://api.test/x' });
    expect(sleep).toHaveBeenCalledWith(3000);
  });

  it('returns long Retry-After to the caller instead of blocking', async () => {
    const fake = new FakeFetch().on('GET api.test/x', { status: 429, headers: { 'retry-after': '3600' } });
    const err = await new HttpClient(classify, { fetch: fake.fetch, sleep: async () => {} }).request<never>({ url: 'https://api.test/x' }).catch((e: unknown) => e as IntegrationError);
    expect(err.category).toBe('RATE_LIMITED');
    expect(err.retryAfterSeconds).toBe(3600);
    expect(fake.calls).toHaveLength(1);
  });

  it('never retries auth or permission failures', async () => {
    const fake = new FakeFetch().on('GET api.test/x', { status: 401 });
    const err = await new HttpClient(classify, { fetch: fake.fetch, sleep: async () => {} }).request<never>({ url: 'https://api.test/x' }).catch((e: unknown) => e as IntegrationError);
    expect(err.category).toBe('AUTH_INVALID');
    expect(fake.calls).toHaveLength(1);
  });

  it('gives up after the attempt budget', async () => {
    const fake = new FakeFetch().on('GET api.test/x', { status: 500 });
    const err = await new HttpClient(classify, { fetch: fake.fetch, sleep: async () => {}, maxAttempts: 2 }).request<never>({ url: 'https://api.test/x' }).catch((e: unknown) => e as IntegrationError);
    expect(err.category).toBe('TRANSIENT');
    expect(fake.calls).toHaveLength(2);
  });

  it('maps network failures to UNREACHABLE', async () => {
    const client = new HttpClient(classify, { fetch: async () => { throw new TypeError('fetch failed'); }, sleep: async () => {}, maxAttempts: 1 });
    await expect(client.request({ url: 'https://api.test/x' })).rejects.toMatchObject({ category: 'UNREACHABLE' });
  });

  it('parses Retry-After seconds and HTTP dates', () => {
    expect(parseRetryAfter('7')).toBe(7);
    expect(parseRetryAfter(new Date(10_000 + 5_000).toUTCString(), 10_000)).toBe(5);
    expect(parseRetryAfter(null)).toBeUndefined();
  });
});
