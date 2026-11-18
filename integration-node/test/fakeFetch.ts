import type { FetchLike } from '../src/shared/http.js';

export interface Recorded {
  method: string;
  url: URL;
  body: string | undefined;
  headers: Record<string, string>;
}

type Reply = { status?: number; body?: unknown; headers?: Record<string, string> };
type Handler = (req: Recorded) => Reply | Promise<Reply>;

/**
 * A routing fake for global fetch: register handlers by "METHOD host/path" prefix; unmatched calls fail loudly.
 * Handlers registered with `once` are consumed in order, which models pagination and retries.
 */
export class FakeFetch {
  readonly calls: Recorded[] = [];
  private readonly routes: { key: string; handler: Handler; once: boolean }[] = [];

  on(key: string, handler: Handler | Reply): this {
    this.routes.push({ key, handler: typeof handler === 'function' ? handler : () => handler, once: false });
    return this;
  }

  once(key: string, handler: Handler | Reply): this {
    this.routes.push({ key, handler: typeof handler === 'function' ? handler : () => handler, once: true });
    return this;
  }

  readonly fetch: FetchLike = async (input, init) => {
    const url = new URL(input);
    const rec: Recorded = {
      method: init?.method ?? 'GET',
      url,
      body: typeof init?.body === 'string' ? init.body : undefined,
      headers: (init?.headers ?? {}) as Record<string, string>,
    };
    this.calls.push(rec);
    const target = `${rec.method} ${url.host}${url.pathname}`;
    const index = this.routes.findIndex((r) => target.startsWith(r.key));
    if (index < 0) throw new Error(`Unexpected request: ${target}`);
    const route = this.routes[index]!;
    if (route.once) this.routes.splice(index, 1);
    const reply = await route.handler(rec);
    return new Response(reply.body === undefined ? '' : JSON.stringify(reply.body), {
      status: reply.status ?? 200,
      headers: { 'content-type': 'application/json', ...reply.headers },
    });
  };

  callsTo(prefix: string): Recorded[] {
    return this.calls.filter((c) => `${c.method} ${c.url.host}${c.url.pathname}`.startsWith(prefix));
  }
}

/** Instant, deterministic retry timing for tests. */
export const noWait = { sleep: async () => {}, random: () => 0.5, maxAttempts: 3 };
