import type { ReactNode } from 'react';
import { cn } from '@/utils/cn';

export type BadgeTone = 'neutral' | 'accent' | 'warning' | 'danger' | 'info' | 'outline';

const TONES: Record<BadgeTone, string> = {
  neutral: 'bg-surface-2 text-fg-2',
  accent: 'bg-accent-soft text-accent',
  warning: 'bg-warning-soft text-warning',
  danger: 'bg-danger-soft text-danger',
  info: 'bg-info-soft text-info',
  outline: 'border border-border-strong text-fg-2',
};

export function Badge({ tone = 'neutral', children, icon, className, title }: { tone?: BadgeTone; children: ReactNode; icon?: ReactNode; className?: string; title?: string }) {
  return (
    <span title={title ?? (typeof children === 'string' ? children : undefined)} className={cn('inline-flex h-5 max-w-full items-center gap-1 whitespace-nowrap rounded px-1.5 text-2xs font-medium [&_svg]:h-3 [&_svg]:w-3 [&_svg]:shrink-0', TONES[tone], className)}>
      {icon}
      <span className="truncate">{children}</span>
    </span>
  );
}

/** Status always pairs color with an icon and a text label — never color alone. */
export function StatusBadge({ tone, icon, label, className }: { tone: BadgeTone; icon: ReactNode; label: string; className?: string }) {
  return (
    <Badge tone={tone} icon={icon} className={className}>
      {label}
    </Badge>
  );
}

export function ProgressBar({ value, tone = 'accent', label, className }: { value: number; tone?: 'accent' | 'warning' | 'danger'; label: string; className?: string }) {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div role="progressbar" aria-label={label} aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100} className={cn('h-1.5 w-full overflow-hidden rounded-full bg-surface-2', className)}>
      <div className={cn('h-full rounded-full transition-[width]', tone === 'accent' && 'bg-accent', tone === 'warning' && 'bg-warning', tone === 'danger' && 'bg-danger')} style={{ width: `${pct}%` }} />
    </div>
  );
}
