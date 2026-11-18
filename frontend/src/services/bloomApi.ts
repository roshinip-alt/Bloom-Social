import type * as T from '@/types/api';
import { api } from './apiClient';

/** One typed function per backend endpoint, grouped by module. */
export const workspaceApi = {
  list: () => api.get<T.Workspace[]>('/workspaces'),
  current: () => api.get<T.Workspace>('/workspaces/current'),
  update: (body: { name: string; timezone: string; defaultCurrency: string }) => api.put<T.Workspace>('/workspaces/current', body),
  resetDemo: () => api.post<T.Workspace>('/workspaces/current/demo-reset'),
};

export const accountsApi = {
  providers: () => api.get<T.ProviderInfo[]>('/providers'),
  list: () => api.get<T.Account[]>('/accounts'),
  get: (id: T.Uuid) => api.get<T.Account>(`/accounts/${id}`),
  sync: (id: T.Uuid) => api.post<T.SyncJob>(`/accounts/${id}/sync`),
  jobs: (id: T.Uuid) => api.get<T.SyncJob[]>(`/accounts/${id}/sync-jobs`, { limit: 10 }),
  disconnect: (id: T.Uuid, deleteHistory: boolean) => api.post<T.DisconnectResult>(`/accounts/${id}/disconnect`, { deleteHistory }),
  remove: (id: T.Uuid) => api.delete(`/accounts/${id}`),
  addDemo: (provider: T.Provider) => api.post<T.Account>(`/connections/${provider.toLowerCase()}/demo`),
  startConnection: (provider: T.Provider) =>
    api.post<{ sessionId: T.Uuid; authorizationUrl: string; expiresAt: T.IsoInstant }>(`/connections/${provider.toLowerCase()}/start`),
  session: (id: T.Uuid) => api.get<T.ConnectSession>(`/connections/sessions/${id}`),
  selectIdentities: (id: T.Uuid, providerAccountIds: string[]) =>
    api.post<T.ConnectSession>(`/connections/sessions/${id}/select`, { providerAccountIds }),
  cancelSession: (id: T.Uuid) => api.post<T.ConnectSession>(`/connections/sessions/${id}/cancel`),
};

export const dashboardApi = {
  get: (q: { from?: string; to?: string; accountId?: string }) => api.get<T.DashboardResponse>('/dashboard', q),
};

export const analyticsApi = {
  metrics: (provider?: T.Provider) => api.get<T.MetricDefinition[]>('/analytics/metrics', { provider }),
  summary: (q: { from?: string; to?: string; accountIds?: string[]; provider?: string }) => api.get<T.SummaryResponse>('/analytics/summary', q),
  series: (q: { accountId: string; metricKey: string; from?: string; to?: string }) => api.get<T.SeriesResponse>('/analytics/series', q),
  posts: (q: { from?: string; to?: string; accountIds?: string[]; provider?: string; contentType?: string; sortMetric?: string; direction?: string; page?: number; size?: number }) =>
    api.get<T.PageResponse<T.Post>>('/posts', q),
};

export const audienceApi = {
  get: (q: { accountId: string; from?: string; to?: string }) => api.get<T.AudienceResponse>('/audience', q),
};

export const planlyApi = {
  calendar: (q: { from: string; to: string; status?: string; priority?: string; goalId?: string }) => api.get<T.CalendarView>('/planly/calendar', q),
  day: (date: string) => api.get<T.DayView>(`/planly/days/${date}`),
  savePlan: (date: string, focus: string) => api.put<T.DayView['plan']>(`/planly/days/${date}/plan`, { focus }),
  saveNote: (date: string, body: string, version: number) => api.put<T.DayView['note']>(`/planly/days/${date}/note`, { body, version }),
  createTask: (body: T.TaskInput) => api.post<T.Task>('/planly/tasks', body),
  updateTask: (id: string, body: T.TaskInput) => api.put<T.Task>(`/planly/tasks/${id}`, body),
  setStatus: (id: string, status: T.TaskStatus) => api.patch<{ task: T.Task; nextOccurrence: T.Task | null }>(`/planly/tasks/${id}/status`, { status }),
  reschedule: (id: string, dueDate: string | null, dueTime?: string | null) => api.patch<T.Task>(`/planly/tasks/${id}/schedule`, { dueDate, dueTime }),
  deleteTask: (id: string) => api.delete(`/planly/tasks/${id}`),
  addSubtask: (taskId: string, title: string) => api.post<T.Subtask>(`/planly/tasks/${taskId}/subtasks`, { title }),
  updateSubtask: (taskId: string, s: T.Subtask) => api.put<T.Subtask>(`/planly/tasks/${taskId}/subtasks/${s.id}`, { title: s.title, done: s.done, position: s.position }),
  deleteSubtask: (taskId: string, id: string) => api.delete(`/planly/tasks/${taskId}/subtasks/${id}`),
};

export const goalsApi = {
  list: (status?: T.GoalStatus[]) => api.get<T.Goal[]>('/goals', { status }),
  get: (id: string) => api.get<T.Goal>(`/goals/${id}`),
  create: (body: T.GoalInput) => api.post<T.Goal>('/goals', body),
  update: (id: string, body: T.GoalInput) => api.put<T.Goal>(`/goals/${id}`, body),
  remove: (id: string) => api.delete(`/goals/${id}`),
  complete: (id: string) => api.post<T.Goal>(`/goals/${id}/complete`),
  archive: (id: string) => api.post<T.Goal>(`/goals/${id}/archive`),
  reopen: (id: string) => api.post<T.Goal>(`/goals/${id}/reopen`),
  history: (id: string) => api.get<T.ProgressEntry[]>(`/goals/${id}/progress`),
  recordProgress: (id: string, value: number, note?: string) => api.post<T.Goal>(`/goals/${id}/progress`, { value, note }),
  deleteProgress: (id: string, entryId: string) => api.delete(`/goals/${id}/progress/${entryId}`),
  addMilestone: (id: string, body: { title: string; targetValue?: number | null; dueDate?: string | null }) => api.post<T.Milestone>(`/goals/${id}/milestones`, body),
  updateMilestone: (id: string, m: { id: string; title: string; targetValue: number | null; dueDate: string | null; achieved: boolean }) =>
    api.put<T.Milestone>(`/goals/${id}/milestones/${m.id}`, m),
  deleteMilestone: (id: string, milestoneId: string) => api.delete(`/goals/${id}/milestones/${milestoneId}`),
};

export const contentApi = {
  pipeline: () => api.get<T.Pipeline>('/content/pipeline'),
  ideas: (includeArchived = false) => api.get<T.Idea[]>('/content/ideas', { includeArchived }),
  createIdea: (body: { title: string; notes?: string | null; platform?: T.Provider | null; tags?: string[] }) => api.post<T.Idea>('/content/ideas', body),
  updateIdea: (id: string, body: { title: string; notes?: string | null; platform?: T.Provider | null; tags?: string[] }) => api.put<T.Idea>(`/content/ideas/${id}`, body),
  archiveIdea: (id: string) => api.post<T.Idea>(`/content/ideas/${id}/archive`),
  restoreIdea: (id: string) => api.post<T.Idea>(`/content/ideas/${id}/restore`),
  deleteIdea: (id: string) => api.delete(`/content/ideas/${id}`),
  promote: (id: string, platform: T.Provider, contentType: T.ContentType) => api.post<T.Draft>(`/content/ideas/${id}/promote`, { platform, contentType }),
  draft: (id: string) => api.get<T.Draft>(`/content/drafts/${id}`),
  createDraft: (body: T.DraftInput) => api.post<T.Draft>('/content/drafts', body),
  updateDraft: (id: string, body: T.DraftInput) => api.put<T.Draft>(`/content/drafts/${id}`, body),
  moveStage: (id: string, stage: T.DraftStage) => api.patch<T.Draft>(`/content/drafts/${id}/stage`, { stage }),
  recordPublication: (id: string, publishedAt: string, publishedUrl?: string) => api.post<T.Draft>(`/content/drafts/${id}/publication`, { publishedAt, publishedUrl }),
  linkPost: (id: string, socialPostId: string) => api.post<T.Draft>(`/content/drafts/${id}/publication/link-post`, { socialPostId }),
  clearPublication: (id: string) => api.delete<T.Draft>(`/content/drafts/${id}/publication`),
  repurpose: (id: string, variants: { platform: T.Provider; contentType: T.ContentType }[]) => api.post<T.Draft[]>(`/content/drafts/${id}/repurpose`, { variants }),
  versions: (id: string) => api.get<T.ContentVersion[]>(`/content/drafts/${id}/versions`),
  restoreVersion: (id: string, version: number) => api.post<T.Draft>(`/content/drafts/${id}/versions/${version}/restore`),
  deleteDraft: (id: string) => api.delete(`/content/drafts/${id}`),
};

export const brandApi = {
  brands: (q?: string) => api.get<T.Brand[]>('/brands', { q }),
  createBrand: (body: T.BrandInput) => api.post<T.Brand>('/brands', body),
  updateBrand: (id: string, body: T.BrandInput) => api.put<T.Brand>(`/brands/${id}`, body),
  deleteBrand: (id: string) => api.delete(`/brands/${id}`),
  campaigns: (q?: { stage?: string; brandId?: string }) => api.get<T.Campaign[]>('/campaigns', q),
  campaign: (id: string) => api.get<T.Campaign>(`/campaigns/${id}`),
  createCampaign: (body: T.CampaignInput) => api.post<T.Campaign>('/campaigns', body),
  updateCampaign: (id: string, body: T.CampaignInput) => api.put<T.Campaign>(`/campaigns/${id}`, body),
  moveStage: (id: string, stage: T.CampaignStage) => api.patch<T.Campaign>(`/campaigns/${id}/stage`, { stage }),
  deleteCampaign: (id: string) => api.delete(`/campaigns/${id}`),
  addDeliverable: (campaignId: string, body: Partial<T.Deliverable> & { title: string }) => api.post<T.Deliverable>(`/campaigns/${campaignId}/deliverables`, body),
  updateDeliverable: (campaignId: string, id: string, body: Partial<T.Deliverable> & { title: string }) => api.put<T.Deliverable>(`/campaigns/${campaignId}/deliverables/${id}`, body),
  deleteDeliverable: (campaignId: string, id: string) => api.delete(`/campaigns/${campaignId}/deliverables/${id}`),
  addPayment: (campaignId: string, body: Partial<T.Payment> & { amount: number }) => api.post<T.Payment>(`/campaigns/${campaignId}/payments`, body),
  updatePayment: (campaignId: string, id: string, body: Partial<T.Payment> & { amount: number }) => api.put<T.Payment>(`/campaigns/${campaignId}/payments/${id}`, body),
  deletePayment: (campaignId: string, id: string) => api.delete(`/campaigns/${campaignId}/payments/${id}`),
  earnings: (year: number) => api.get<T.EarningsSummary>('/earnings/summary', { year }),
};
