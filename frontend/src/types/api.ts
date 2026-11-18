/**
 * Typed contracts for the Bloom REST API (/api/v1). They mirror the Java DTO records.
 * A `null` metric value is "not available" — the UI must never render it as zero.
 */
export type Uuid = string;
export type IsoDate = string; // yyyy-MM-dd (workspace calendar date)
export type IsoInstant = string; // UTC instant

export type Provider = 'INSTAGRAM' | 'YOUTUBE' | 'TIKTOK';
export const PROVIDERS: Provider[] = ['INSTAGRAM', 'YOUTUBE', 'TIKTOK'];

export interface ApiErrorBody {
  code: string;
  message: string;
  correlationId?: string;
  fieldErrors?: { field: string; message: string }[];
}

export interface PageResponse<T> {
  items: T[];
  page: number;
  size: number;
  totalItems: number;
  totalPages: number;
}

// ---------------------------------------------------------------- workspace
export interface Workspace {
  id: Uuid;
  name: string;
  timezone: string;
  defaultCurrency: string;
  demo: boolean;
}

// ---------------------------------------------------------------- social
export type Capability =
  | 'PROFILE_READ'
  | 'ACCOUNT_METRICS'
  | 'CONTENT_LIST'
  | 'CONTENT_METRICS'
  | 'AUDIENCE_INSIGHTS'
  | 'PUBLISHING'
  | 'TOKEN_REFRESH';

export type ConnectionStatus = 'ACTIVE' | 'EXPIRED' | 'PERMISSION_DENIED' | 'REVOKED' | 'DISCONNECTED' | 'ERROR';
export type DataMode = 'LIVE' | 'DEMO';
export type SyncJobStatus = 'QUEUED' | 'RUNNING' | 'SUCCEEDED' | 'PARTIAL' | 'FAILED';

export interface SyncJob {
  id: Uuid;
  trigger: 'MANUAL' | 'SCHEDULED' | 'CONNECT';
  status: SyncJobStatus;
  attempt: number;
  itemsFetched: number;
  errorCode: string | null;
  errorMessage: string | null;
  nextRetryAt: IsoInstant | null;
  startedAt: IsoInstant | null;
  finishedAt: IsoInstant | null;
  createdAt: IsoInstant;
}

export interface Account {
  id: Uuid;
  provider: Provider;
  providerAccountId: string;
  handle: string | null;
  displayName: string | null;
  avatarUrl: string | null;
  accountType: string | null;
  dataMode: DataMode;
  connectionStatus: ConnectionStatus;
  needsReconnect: boolean;
  grantedScopes: string[];
  capabilities: Capability[];
  lastSyncAt: IsoInstant | null;
  lastSuccessfulSyncAt: IsoInstant | null;
  lastSyncError: string | null;
  connectedAt: IsoInstant;
  disconnectedAt: IsoInstant | null;
  tokenExpiresAt: IsoInstant | null;
  latestJob: SyncJob | null;
}

export interface ProviderInfo {
  provider: Provider;
  displayName: string;
  apiFamily: string;
  docsPath: string;
  requestedScopes: string[];
  supportedCapabilities: Capability[];
  dataAccessed: string[];
  notAvailable: string[];
  prerequisites: string[];
  accessExplanation: string;
  docsVerified: boolean;
  liveConfigured: boolean;
  integrationReachable: boolean;
  missingConfig: string[];
  redirectUri: string;
  demoAvailable: boolean;
}

export type SessionStatus = 'PENDING' | 'AWAITING_SELECTION' | 'COMPLETED' | 'FAILED' | 'EXPIRED' | 'CANCELLED';

export interface IdentityCandidate {
  providerAccountId: string;
  handle: string | null;
  displayName: string | null;
  avatarUrl: string | null;
  accountType: string | null;
  eligible: boolean;
  ineligibleReason: string | null;
}

export interface ConnectSession {
  id: Uuid;
  provider: Provider;
  status: SessionStatus;
  candidates: IdentityCandidate[];
  connectedAccountIds: Uuid[];
  errorCode: string | null;
  errorMessage: string | null;
  createdAt: IsoInstant;
  expiresAt: IsoInstant;
}

export interface DisconnectResult {
  accountId: Uuid;
  revocation: 'REVOKED' | 'NOT_SUPPORTED' | 'FAILED' | 'NOT_APPLICABLE';
  note: string;
  historyRetained: boolean;
}

// ---------------------------------------------------------------- analytics
export type Availability =
  | 'AVAILABLE'
  | 'NOT_SUPPORTED'
  | 'PERMISSION_MISSING'
  | 'NOT_ENOUGH_DATA'
  | 'DELAYED'
  | 'NO_DATA'
  | 'BEFORE_HISTORY';

export type Unit = 'COUNT' | 'MINUTES' | 'SECONDS' | 'PERCENT';

export interface AccountRef {
  id: Uuid;
  provider: Provider;
  handle: string | null;
  displayName: string | null;
  avatarUrl: string | null;
  dataMode: DataMode;
  connectionStatus: ConnectionStatus;
  lastSuccessfulSyncAt: IsoInstant | null;
}

export interface MetricDefinition {
  metricKey: string;
  provider: Provider;
  sourceMetric: string;
  canonicalKey: string;
  scope: 'ACCOUNT' | 'POST' | 'AUDIENCE';
  label: string;
  description: string;
  unit: Unit;
  measureType: 'STOCK' | 'FLOW';
  apiSource: string;
}

export interface MetricValue {
  metricKey: string;
  label: string;
  description: string;
  unit: Unit;
  measureType: 'STOCK' | 'FLOW';
  canonicalKey: string;
  value: number | null;
  previousValue: number | null;
  change: number | null;
  availability: Availability;
  coveredDays: number;
  rangeDays: number;
  firstDataDate: IsoDate | null;
  lastDataDate: IsoDate | null;
  lastFetchedAt: IsoInstant | null;
  apiSource: string;
  demo: boolean;
}

export interface AccountSummary {
  account: AccountRef;
  metrics: MetricValue[];
}

export interface SummaryResponse {
  from: IsoDate;
  to: IsoDate;
  previousFrom: IsoDate;
  previousTo: IsoDate;
  accounts: AccountSummary[];
}

export interface SeriesPoint {
  date: IsoDate;
  value: number | null;
  availability: Availability;
}

export interface SeriesResponse {
  accountId: Uuid;
  metricKey: string;
  label: string;
  unit: Unit;
  from: IsoDate;
  to: IsoDate;
  points: SeriesPoint[];
  firstDataDate: IsoDate | null;
  lastFetchedAt: IsoInstant | null;
  apiSource: string;
  demo: boolean;
}

export interface Post {
  id: Uuid;
  accountId: Uuid;
  provider: Provider;
  accountHandle: string | null;
  providerContentId: string;
  contentType: string;
  title: string | null;
  permalink: string | null;
  thumbnailUrl: string | null;
  publishedAt: IsoInstant;
  durationSeconds: number | null;
  demo: boolean;
  fetchedAt: IsoInstant;
  metrics: Record<string, number>;
  metricsAsOf: IsoDate | null;
}

// ---------------------------------------------------------------- audience
export interface AudienceBucket {
  key: string;
  label: string;
  value: number;
  sharePercent: number | null;
}

export interface AudienceDimension {
  dimension: string;
  label: string;
  availability: Availability;
  reason: string | null;
  metricKey: string | null;
  unit: Unit | null;
  apiField: string | null;
  asOf: IsoDate | null;
  window: string | null;
  fetchedAt: IsoInstant | null;
  source: string | null;
  demo: boolean;
  buckets: AudienceBucket[];
}

export interface AudienceResponse {
  account: AccountRef;
  growth: { metricKey: string; label: string; points: SeriesPoint[]; firstDataDate: IsoDate | null };
  dimensions: AudienceDimension[];
}

// ---------------------------------------------------------------- dashboard
export type SyncState = 'FRESH' | 'STALE' | 'SYNCING' | 'NEEDS_RECONNECT' | 'ERROR' | 'DISCONNECTED' | 'NEVER_SYNCED';

export interface AccountHealth {
  account: AccountRef;
  syncState: SyncState;
  lastSuccessfulSyncAt: IsoInstant | null;
  lastSyncError: string | null;
}

export interface Aggregate {
  canonicalKey: string;
  label: string;
  unit: Unit;
  measureType: 'STOCK' | 'FLOW';
  description: string;
  value: number | null;
  previousValue: number | null;
  change: number | null;
  contributors: { account: AccountRef; value: number }[];
  missing: { account: AccountRef; reason: Availability }[];
  notReportedBy: AccountRef[];
}

export interface DashboardResponse {
  from: IsoDate;
  to: IsoDate;
  previousFrom: IsoDate;
  previousTo: IsoDate;
  accounts: AccountHealth[];
  headline: Aggregate[];
  audienceTrend: { account: AccountRef; metricKey: string; label: string; points: SeriesPoint[] }[];
  contentPublished: { syncedPosts: { account: AccountRef; posts: number }[]; manuallyRecordedDrafts: number };
  topContent: { provider: Provider; metricKey: string; metricLabel: string; posts: Post[] }[];
  upcomingTasks: Task[];
  overdueTasks: number;
  goals: Goal[];
  demoWorkspace: boolean;
}

// ---------------------------------------------------------------- planly
export type TaskPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
export type TaskStatus = 'TODO' | 'IN_PROGRESS' | 'DONE' | 'CANCELLED';
export type Recurrence = 'NONE' | 'DAILY' | 'WEEKLY' | 'MONTHLY';

export interface Subtask {
  id: Uuid;
  title: string;
  done: boolean;
  position: number;
}

export interface Task {
  id: Uuid;
  title: string;
  description: string | null;
  dueDate: IsoDate | null;
  dueTime: string | null;
  priority: TaskPriority;
  status: TaskStatus;
  recurrence: Recurrence;
  recurrenceUntil: IsoDate | null;
  goalId: Uuid | null;
  goalTitle: string | null;
  contentDraftId: Uuid | null;
  overdue: boolean;
  completedAt: IsoInstant | null;
  subtasks: Subtask[];
  createdAt: IsoInstant;
  updatedAt: IsoInstant;
}

export interface TaskInput {
  title: string;
  description?: string | null;
  dueDate?: IsoDate | null;
  dueTime?: string | null;
  priority?: TaskPriority;
  status?: TaskStatus;
  recurrence?: Recurrence;
  recurrenceUntil?: IsoDate | null;
  goalId?: Uuid | null;
  contentDraftId?: Uuid | null;
}

export interface CalendarDay {
  date: IsoDate;
  openTasks: number;
  doneTasks: number;
  hasNote: boolean;
  focus: string | null;
}

export interface CalendarView {
  from: IsoDate;
  to: IsoDate;
  today: IsoDate;
  timezone: string;
  days: CalendarDay[];
  tasks: Task[];
  undated: Task[];
  overdue: Task[];
}

export interface DayView {
  date: IsoDate;
  today: boolean;
  plan: { date: IsoDate; focus: string | null; updatedAt: IsoInstant | null };
  note: { date: IsoDate; body: string; version: number; updatedAt: IsoInstant | null };
  tasks: Task[];
}

// ---------------------------------------------------------------- goals
export type GoalCategory = 'AUDIENCE' | 'CONTENT' | 'REVENUE' | 'ENGAGEMENT' | 'SKILL' | 'PERSONAL';
export type GoalStatus = 'ACTIVE' | 'COMPLETED' | 'ARCHIVED';
export type GoalState = 'NOT_STARTED' | 'ON_TRACK' | 'AT_RISK' | 'OVERDUE' | 'COMPLETED' | 'ARCHIVED';

export interface Milestone {
  id: Uuid;
  title: string;
  targetValue: number | null;
  dueDate: IsoDate | null;
  achievedAt: IsoInstant | null;
  position: number;
}

export interface Goal {
  id: Uuid;
  title: string;
  category: GoalCategory;
  description: string | null;
  unit: string;
  startValue: number;
  targetValue: number;
  currentValue: number;
  progressPercent: number;
  targetReached: boolean;
  startDate: IsoDate;
  deadline: IsoDate | null;
  daysRemaining: number | null;
  progressSource: 'MANUAL' | 'ANALYTICS';
  linkedMetric: {
    accountId: Uuid | null;
    accountHandle: string | null;
    provider: Provider | null;
    metricKey: string;
    label: string;
    measureType: 'STOCK' | 'FLOW' | null;
    available: boolean;
    note: string | null;
  } | null;
  status: GoalStatus;
  state: GoalState;
  completedAt: IsoInstant | null;
  milestones: Milestone[];
  createdAt: IsoInstant;
  updatedAt: IsoInstant;
}

export interface GoalInput {
  title: string;
  category: GoalCategory;
  description?: string | null;
  unit: string;
  startValue?: number;
  targetValue: number;
  startDate: IsoDate;
  deadline?: IsoDate | null;
  progressSource?: 'MANUAL' | 'ANALYTICS';
  linkedAccountId?: Uuid | null;
  linkedMetricKey?: string | null;
}

export interface ProgressEntry {
  id: Uuid;
  value: number;
  source: 'MANUAL' | 'ANALYTICS';
  note: string | null;
  recordedAt: IsoInstant;
}

// ---------------------------------------------------------------- content
export type DraftStage = 'SCRIPT' | 'IN_PRODUCTION' | 'READY' | 'PUBLISHED';
export type ContentType = 'POST' | 'CAROUSEL' | 'REEL' | 'STORY' | 'SHORT' | 'VIDEO' | 'LIVE';

export interface Idea {
  id: Uuid;
  title: string;
  notes: string | null;
  platform: Provider | null;
  tags: string[];
  status: 'OPEN' | 'PROMOTED' | 'ARCHIVED';
  createdAt: IsoInstant;
  updatedAt: IsoInstant;
}

export interface Draft {
  id: Uuid;
  ideaId: Uuid | null;
  parentDraftId: Uuid | null;
  parentTitle: string | null;
  title: string;
  platform: Provider;
  contentType: ContentType;
  caption: string | null;
  script: string | null;
  hashtags: string[];
  notes: string | null;
  plannedDate: IsoDate | null;
  stage: DraftStage;
  goalId: Uuid | null;
  goalTitle: string | null;
  campaignId: Uuid | null;
  campaignName: string | null;
  publishedAt: IsoInstant | null;
  publishedUrl: string | null;
  publicationSource: 'MANUAL' | 'VERIFIED_API' | null;
  socialPostId: Uuid | null;
  currentVersion: number;
  variantCount: number;
  createdAt: IsoInstant;
  updatedAt: IsoInstant;
}

export interface DraftInput {
  title: string;
  platform: Provider;
  contentType: ContentType;
  caption?: string | null;
  script?: string | null;
  hashtags?: string[];
  notes?: string | null;
  plannedDate?: IsoDate | null;
  goalId?: Uuid | null;
  campaignId?: Uuid | null;
  changeSummary?: string | null;
}

export interface ContentVersion {
  id: Uuid;
  versionNumber: number;
  snapshot: { title: string; caption: string | null; script: string | null; hashtags: string[]; notes: string | null };
  changeSummary: string | null;
  createdAt: IsoInstant;
}

export interface Pipeline {
  ideas: Idea[];
  stages: Record<DraftStage, Draft[]>;
}

// ---------------------------------------------------------------- brand & earnings
export type CampaignStage = 'LEAD' | 'CONTACTED' | 'NEGOTIATING' | 'CONFIRMED' | 'IN_PROGRESS' | 'DELIVERED' | 'PAID' | 'ARCHIVED';
export type DeliverableStatus = 'PLANNED' | 'IN_PROGRESS' | 'SUBMITTED' | 'APPROVED' | 'PUBLISHED';

export interface Brand {
  id: Uuid;
  brandName: string;
  contactName: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  notes: string | null;
  campaignCount: number;
  createdAt: IsoInstant;
  updatedAt: IsoInstant;
}

export interface BrandInput {
  brandName: string;
  contactName?: string | null;
  email?: string | null;
  phone?: string | null;
  website?: string | null;
  notes?: string | null;
}

export interface Deliverable {
  id: Uuid;
  campaignId: Uuid;
  title: string;
  platform: Provider | null;
  dueDate: IsoDate | null;
  status: DeliverableStatus;
  contentDraftId: Uuid | null;
  notes: string | null;
  overdue: boolean;
}

export interface Payment {
  id: Uuid;
  campaignId: Uuid;
  amount: number;
  currency: string;
  invoiceReference: string | null;
  invoicedDate: IsoDate | null;
  dueDate: IsoDate | null;
  paidDate: IsoDate | null;
  note: string | null;
  paid: boolean;
  overdue: boolean;
}

export interface Campaign {
  id: Uuid;
  brandContactId: Uuid;
  brandName: string | null;
  name: string;
  stage: CampaignStage;
  agreedAmount: number | null;
  currency: string;
  paidAmount: number;
  outstandingAmount: number | null;
  startDate: IsoDate | null;
  endDate: IsoDate | null;
  nextDeadline: IsoDate | null;
  notes: string | null;
  deliverables: Deliverable[];
  payments: Payment[];
  createdAt: IsoInstant;
  updatedAt: IsoInstant;
}

export interface CampaignInput {
  brandContactId: Uuid;
  name: string;
  stage?: CampaignStage;
  agreedAmount?: number | null;
  currency: string;
  startDate?: IsoDate | null;
  endDate?: IsoDate | null;
  notes?: string | null;
}

export interface CurrencySummary {
  currency: string;
  paidInYear: number;
  invoicedUnpaid: number;
  overdue: number;
  committedUnpaid: number;
  pipelineValue: number;
  monthly: { month: number; paid: number }[];
}

export interface EarningsSummary {
  year: number;
  today: IsoDate;
  currencies: CurrencySummary[];
  activeCampaigns: number;
  overduePayments: number;
}
