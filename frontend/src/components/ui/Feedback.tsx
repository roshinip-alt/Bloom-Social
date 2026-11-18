import { AlertTriangle, Info, RefreshCw, XCircle, type LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { ApiError } from '@/services/apiClient';
import { cn } from '@/utils/cn';
import { Button } from './Button';

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cn('animate-pulse rounded-md bg-surface-2', className)} />;
}

/** Placeholder layout while a panel loads. */
export function PanelSkeleton({ rows = 4, className }: { rows?: number; className?: string }) {
  return (
    <div className={cn('panel space-y-3 p-4', className)} role="status" aria-label="Loading">
      <Skeleton className="h-4 w-1/3" />
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} className="h-8 w-full" />
      ))}
    </div>
  );
}

/** First-use / no-results state with a clear next step. */
export function EmptyState({ icon: Icon, title, description, action, className }: {
  icon: LucideIcon;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-col items-center justify-center px-6 py-10 text-center', className)}>
      <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg border border-border bg-surface-2 text-fg-2">
        <Icon className="h-5 w-5" aria-hidden />
      </div>
      <h3 className="text-sm font-semibold">{title}</h3>
      {description && <p className="mt-1 max-w-sm text-sm text-fg-2">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

/** Inline error with a retry. Shows the server's message and correlation id (for support), never internals. */
export function ErrorState({ error, onRetry, title = "Couldn't load this", className }: { error: unknown; onRetry?: () => void; title?: string; className?: string }) {
  const apiError = error instanceof ApiError ? error : null;
  return (
    <div role="alert" className={cn('flex flex-col items-center justify-center px-6 py-10 text-center', className)}>
      <XCircle className="mb-2 h-6 w-6 text-danger" aria-hidden />
      <h3 className="text-sm font-semibold">{title}</h3>
      <p className="mt-1 max-w-md text-sm text-fg-2">{apiError?.message ?? 'Something went wrong. Try again.'}</p>
      {apiError?.correlationId && <p className="mt-1 text-2xs text-fg-3">Reference {apiError.correlationId}</p>}
      {onRetry && (
        <Button size="sm" className="mt-4" onClick={onRetry}>
          <RefreshCw /> Try again
        </Button>
      )}
    </div>
  );
}

const ALERT_TONES = {
  info: { icon: Info, cls: 'border-info/25 bg-info-soft text-fg', iconCls: 'text-info' },
  warning: { icon: AlertTriangle, cls: 'border-warning/30 bg-warning-soft text-fg', iconCls: 'text-warning' },
  danger: { icon: XCircle, cls: 'border-danger/30 bg-danger-soft text-fg', iconCls: 'text-danger' },
  accent: { icon: Info, cls: 'border-accent/25 bg-accent-soft text-fg', iconCls: 'text-accent' },
} as const;

/** Persistent, inline banner for partial data, stale syncs, permission problems and other important states. */
export function Alert({ tone = 'info', title, children, action, className }: { tone?: keyof typeof ALERT_TONES; title?: string; children?: ReactNode; action?: ReactNode; className?: string }) {
  const t = ALERT_TONES[tone];
  const Icon = t.icon;
  return (
    <div role={tone === 'danger' ? 'alert' : 'status'} className={cn('flex items-start gap-2.5 rounded-lg border px-3 py-2.5 text-sm', t.cls, className)}>
      <Icon className={cn('mt-0.5 h-4 w-4 shrink-0', t.iconCls)} aria-hidden />
      <div className="min-w-0 flex-1">
        {title && <p className="font-medium">{title}</p>}
        {children && <div className={cn('text-fg-2', title && 'mt-0.5')}>{children}</div>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

/** Message for a mutation error, used inline in forms and drawers. */
export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  return 'Something went wrong. Try again.';
}
