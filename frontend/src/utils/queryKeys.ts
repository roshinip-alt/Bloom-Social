/**
 * Query keys are prefixed by module so mutations can invalidate precisely. Workspace switches clear the whole
 * cache (see WorkspaceProvider), so keys do not need the workspace id.
 */
export const qk = {
  workspaces: ['workspaces'] as const,
  currentWorkspace: ['workspace', 'current'] as const,
  providers: ['social', 'providers'] as const,
  accounts: ['social', 'accounts'] as const,
  accountJobs: (id: string) => ['social', 'accounts', id, 'jobs'] as const,
  session: (id: string) => ['social', 'session', id] as const,
  dashboard: (params: object) => ['dashboard', params] as const,
  metricDefinitions: ['analytics', 'definitions'] as const,
  summary: (params: object) => ['analytics', 'summary', params] as const,
  series: (params: object) => ['analytics', 'series', params] as const,
  posts: (params: object) => ['analytics', 'posts', params] as const,
  audience: (params: object) => ['audience', params] as const,
  calendar: (params: object) => ['planly', 'calendar', params] as const,
  day: (date: string) => ['planly', 'day', date] as const,
  goals: (status?: string[]) => ['goals', 'list', status ?? 'all'] as const,
  goal: (id: string) => ['goals', 'detail', id] as const,
  goalHistory: (id: string) => ['goals', 'history', id] as const,
  pipeline: ['content', 'pipeline'] as const,
  draft: (id: string) => ['content', 'draft', id] as const,
  versions: (id: string) => ['content', 'versions', id] as const,
  brands: (q?: string) => ['brand', 'brands', q ?? ''] as const,
  campaigns: ['brand', 'campaigns'] as const,
  campaign: (id: string) => ['brand', 'campaign', id] as const,
  earnings: (year: number) => ['brand', 'earnings', year] as const,
};
