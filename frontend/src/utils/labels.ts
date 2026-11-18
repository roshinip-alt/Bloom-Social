import type {
  Availability,
  CampaignStage,
  Capability,
  ConnectionStatus,
  ContentType,
  DeliverableStatus,
  DraftStage,
  GoalCategory,
  GoalState,
  Provider,
  Recurrence,
  SyncState,
  TaskPriority,
  TaskStatus,
} from '@/types/api';

export const PROVIDER_LABEL: Record<Provider, string> = { INSTAGRAM: 'Instagram', YOUTUBE: 'YouTube', TIKTOK: 'TikTok' };

/** Owner-facing explanation for a missing metric value. Never "0". */
export function availabilityText(a: Availability | string | null | undefined, provider?: Provider): string {
  const platform = provider ? PROVIDER_LABEL[provider] : 'this platform';
  switch (a) {
    case 'NOT_SUPPORTED':
      return `Not available from ${platform}'s API`;
    case 'PERMISSION_MISSING':
      return 'Permission not granted — reconnect and approve access';
    case 'NOT_ENOUGH_DATA':
      return `${platform} withholds this below its privacy threshold`;
    case 'DELAYED':
      return `${platform} has not finished processing this period`;
    case 'BEFORE_HISTORY':
      return 'Before the first synced snapshot — earlier history is not invented';
    case 'NO_DATA':
      return 'No synced data for this period';
    default:
      return 'Not available';
  }
}

export const CONNECTION_STATUS_LABEL: Record<ConnectionStatus, string> = {
  ACTIVE: 'Connected',
  EXPIRED: 'Token expired',
  PERMISSION_DENIED: 'Permission removed',
  REVOKED: 'Access revoked',
  DISCONNECTED: 'Disconnected',
  ERROR: 'Sync error',
};

export const SYNC_STATE_LABEL: Record<SyncState, string> = {
  FRESH: 'Up to date',
  STALE: 'Stale',
  SYNCING: 'Syncing',
  NEEDS_RECONNECT: 'Reconnect needed',
  ERROR: 'Sync error',
  DISCONNECTED: 'Disconnected',
  NEVER_SYNCED: 'Not synced yet',
};

export const CAPABILITY_LABEL: Record<Capability, string> = {
  PROFILE_READ: 'Profile',
  ACCOUNT_METRICS: 'Account metrics',
  CONTENT_LIST: 'Content list',
  CONTENT_METRICS: 'Content metrics',
  AUDIENCE_INSIGHTS: 'Audience insights',
  PUBLISHING: 'Publishing',
  TOKEN_REFRESH: 'Background refresh',
};

export const TASK_STATUS_LABEL: Record<TaskStatus, string> = { TODO: 'To do', IN_PROGRESS: 'In progress', DONE: 'Done', CANCELLED: 'Cancelled' };
export const PRIORITY_LABEL: Record<TaskPriority, string> = { LOW: 'Low', MEDIUM: 'Medium', HIGH: 'High', URGENT: 'Urgent' };
export const RECURRENCE_LABEL: Record<Recurrence, string> = { NONE: 'Does not repeat', DAILY: 'Daily', WEEKLY: 'Weekly', MONTHLY: 'Monthly' };

export const GOAL_CATEGORY_LABEL: Record<GoalCategory, string> = {
  AUDIENCE: 'Audience', CONTENT: 'Content', REVENUE: 'Revenue', ENGAGEMENT: 'Engagement', SKILL: 'Skill', PERSONAL: 'Personal',
};
export const GOAL_STATE_LABEL: Record<GoalState, string> = {
  NOT_STARTED: 'Not started', ON_TRACK: 'On track', AT_RISK: 'At risk', OVERDUE: 'Overdue', COMPLETED: 'Completed', ARCHIVED: 'Archived',
};

export const DRAFT_STAGES: DraftStage[] = ['SCRIPT', 'IN_PRODUCTION', 'READY', 'PUBLISHED'];
export const DRAFT_STAGE_LABEL: Record<DraftStage, string> = { SCRIPT: 'Script', IN_PRODUCTION: 'In production', READY: 'Ready', PUBLISHED: 'Published' };
export const CONTENT_TYPES: ContentType[] = ['POST', 'CAROUSEL', 'REEL', 'STORY', 'SHORT', 'VIDEO', 'LIVE'];
export const CONTENT_TYPE_LABEL: Record<ContentType, string> = {
  POST: 'Post', CAROUSEL: 'Carousel', REEL: 'Reel', STORY: 'Story', SHORT: 'Short', VIDEO: 'Video', LIVE: 'Live',
};

export const CAMPAIGN_STAGES: CampaignStage[] = ['LEAD', 'CONTACTED', 'NEGOTIATING', 'CONFIRMED', 'IN_PROGRESS', 'DELIVERED', 'PAID', 'ARCHIVED'];
export const CAMPAIGN_STAGE_LABEL: Record<CampaignStage, string> = {
  LEAD: 'Lead', CONTACTED: 'Contacted', NEGOTIATING: 'Negotiating', CONFIRMED: 'Confirmed',
  IN_PROGRESS: 'In progress', DELIVERED: 'Delivered', PAID: 'Paid', ARCHIVED: 'Archived',
};
export const DELIVERABLE_STATUS_LABEL: Record<DeliverableStatus, string> = {
  PLANNED: 'Planned', IN_PROGRESS: 'In progress', SUBMITTED: 'Submitted', APPROVED: 'Approved', PUBLISHED: 'Published',
};

/** Human label for a scope string (falls back to the raw scope). */
export function scopeLabel(scope: string): string {
  const known: Record<string, string> = {
    instagram_business_basic: 'Profile & media (read)',
    instagram_business_manage_insights: 'Insights (read)',
    'https://www.googleapis.com/auth/youtube.readonly': 'YouTube account (read-only)',
    'https://www.googleapis.com/auth/yt-analytics.readonly': 'YouTube Analytics (read-only)',
    'user.info.basic': 'Basic profile',
    'user.info.profile': 'Profile details',
    'user.info.stats': 'Follower & like counts',
    'video.list': 'Public videos',
  };
  return known[scope] ?? scope;
}
