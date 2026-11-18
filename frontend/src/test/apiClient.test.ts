import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError, api } from '@/services/apiClient';
import { workspaceStore } from '@/services/workspaceStore';

afterEach(() => vi.unstubAllGlobals());

describe('api client', () => {
  it('sends the selected workspace and parses JSON', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ ok: true }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    workspaceStore.set('ws-123');
    await expect(api.get('/dashboard', { from: '2026-01-01', accountIds: ['a', 'b'], empty: '' })).resolves.toEqual({ ok: true });
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('/api/v1/dashboard?from=2026-01-01&accountIds=a&accountIds=b');
    expect((init.headers as Record<string, string>)['X-Bloom-Workspace-Id']).toBe('ws-123');
  });

  it('turns error bodies into ApiError with field errors and correlation id', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({
      code: 'VALIDATION_FAILED', message: 'Some fields are invalid', correlationId: 'cid-1', fieldErrors: [{ field: 'title', message: 'must not be blank' }],
    }), { status: 400 })));
    const error = await api.post<never>('/planly/tasks', {}).catch((e: unknown) => e as ApiError);
    expect(error).toBeInstanceOf(ApiError);
    expect(error.code).toBe('VALIDATION_FAILED');
    expect(error.fieldError('title')).toBe('must not be blank');
    expect(error.correlationId).toBe('cid-1');
  });

  it('reports network failures clearly', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('Failed to fetch'); }));
    await expect(api.get('/goals')).rejects.toMatchObject({ code: 'NETWORK_ERROR', status: 0 });
  });
});
