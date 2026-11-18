import { Instagram, Music2, Youtube } from 'lucide-react';
import type { Provider } from '@/types/api';
import { cn } from '@/utils/cn';
import { PROVIDER_LABEL } from '@/utils/labels';

const ICON = { INSTAGRAM: Instagram, YOUTUBE: Youtube, TIKTOK: Music2 };

/** Platform identity is text + a neutral line icon; no brand colors are reproduced. */
export function PlatformBadge({ provider, compact = false, className }: { provider: Provider; compact?: boolean; className?: string }) {
  const Icon = ICON[provider];
  return (
    <span className={cn('inline-flex items-center gap-1 text-xs text-fg-2', className)} title={PROVIDER_LABEL[provider]}>
      <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden />
      {compact ? <span className="sr-only">{PROVIDER_LABEL[provider]}</span> : PROVIDER_LABEL[provider]}
    </span>
  );
}

export function PlatformIcon({ provider, className }: { provider: Provider; className?: string }) {
  const Icon = ICON[provider];
  return <Icon className={cn('h-4 w-4', className)} aria-label={PROVIDER_LABEL[provider]} />;
}
