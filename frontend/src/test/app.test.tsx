import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { App } from '@/App';

const workspace = { id: 'demo', name: 'Demo workspace', timezone: 'Europe/London', defaultCurrency: 'USD', demo: true };
const dashboard = {
  from: '2026-01-01', to: '2026-01-28', previousFrom: '2025-12-04', previousTo: '2025-12-31', accounts: [], headline: [], audienceTrend: [],
  contentPublished: { syncedPosts: [], manuallyRecordedDrafts: 0 }, topContent: [], upcomingTasks: [], overdueTasks: 0, goals: [], demoWorkspace: true,
};

afterEach(() => vi.unstubAllGlobals());

describe('App shell', () => {
  it('renders navigation in the specified order and the demo notice, with no sign-in screen', async () => {
    vi.stubGlobal('matchMedia', () => ({ matches: false, addEventListener: () => {}, removeEventListener: () => {} }));
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      const body = url.startsWith('/api/v1/workspaces') ? [workspace] : url.startsWith('/api/v1/dashboard') ? dashboard : url.startsWith('/api/v1/accounts') ? [] : {};
      return new Response(JSON.stringify(body), { status: 200 });
    }));
    render(<App />);
    expect(await screen.findByText('Demo workspace — synthetic sample data')).toBeInTheDocument();
    const nav = screen.getAllByRole('navigation', { name: 'Main' })[0]!;
    const labels = Array.from(nav.querySelectorAll('a [data-nav-label]')).map((a) => a.textContent);
    expect(labels).toEqual(['Dashboard', 'Planly', 'Content Studio', 'Goals', 'Analytics', 'Audience', 'Brand & Earnings', 'Connected accounts', 'Settings']);
    expect(await screen.findByText('Connect an account to see performance')).toBeInTheDocument();
    expect(screen.queryByText(/sign in|log in|password/i)).not.toBeInTheDocument();
  });
});
