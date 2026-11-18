import { AlertTriangle, CheckCircle2, CircleSlash, Clock, Loader2, PlugZap, XCircle } from 'lucide-react';
import type { SyncState } from '@/types/api';
import { relativeTime } from '@/utils/dates';
import { SYNC_STATE_LABEL } from '@/utils/labels';
import { StatusBadge, type BadgeTone } from '../ui/Badge';
import { Tooltip } from '../ui/Tooltip';

const STYLE: Record<SyncState, { tone: BadgeTone; icon: JSX.Element }> = {
  FRESH: { tone: 'accent', icon: <CheckCircle2 /> },
  STALE: { tone: 'warning', icon: <Clock /> },
  SYNCING: { tone: 'info', icon: <Loader2 className="animate-spin" /> },
  NEEDS_RECONNECT: { tone: 'danger', icon: <PlugZap /> },
  ERROR: { tone: 'danger', icon: <XCircle /> },
  DISCONNECTED: { tone: 'neutral', icon: <CircleSlash /> },
  NEVER_SYNCED: { tone: 'neutral', icon: <AlertTriangle /> },
};

/** Sync freshness: icon + label + last successful sync (data is periodic, never "real-time"). */
export function SyncStatus({ state, lastSuccessfulSyncAt, detail }: { state: SyncState; lastSuccessfulSyncAt: string | null; detail?: string | null }) {
  const s = STYLE[state];
  const tip = [lastSuccessfulSyncAt ? `Last successful sync ${relativeTime(lastSuccessfulSyncAt)}` : 'Never synced successfully', detail].filter(Boolean).join(' · ');
  return (
    <Tooltip content={tip}>
      <span tabIndex={0} className="inline-flex rounded focus-visible:ring-2">
        <StatusBadge tone={s.tone} icon={s.icon} label={SYNC_STATE_LABEL[state]} />
      </span>
    </Tooltip>
  );
}

/** Derives the same freshness states the dashboard uses, from an account record. */
export function syncStateOf(a: { connectionStatus: string; lastSuccessfulSyncAt: string | null; latestJob: { status: string } | null }): SyncState {
  if (a.connectionStatus === 'DISCONNECTED') return 'DISCONNECTED';
  if (['EXPIRED', 'PERMISSION_DENIED', 'REVOKED'].includes(a.connectionStatus)) return 'NEEDS_RECONNECT';
  if (a.latestJob && ['QUEUED', 'RUNNING'].includes(a.latestJob.status)) return 'SYNCING';
  if (a.connectionStatus === 'ERROR') return 'ERROR';
  if (!a.lastSuccessfulSyncAt) return 'NEVER_SYNCED';
  return Date.now() - Date.parse(a.lastSuccessfulSyncAt) > 24 * 3600 * 1000 ? 'STALE' : 'FRESH';
}
