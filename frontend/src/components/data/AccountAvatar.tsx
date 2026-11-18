import { useState } from 'react';
import type { Provider } from '@/types/api';
import { cn } from '@/utils/cn';
import { PlatformIcon } from './PlatformBadge';

/** Profile picture with an initials fallback and a small platform marker. */
export function AccountAvatar({ name, avatarUrl, provider, size = 'md' }: { name: string; avatarUrl?: string | null; provider: Provider; size?: 'sm' | 'md' }) {
  const [failed, setFailed] = useState(false);
  const initials = name.replace(/^@/, '').split(/[\s._-]+/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join('') || '?';
  const dim = size === 'sm' ? 'h-6 w-6 text-2xs' : 'h-8 w-8 text-xs';
  return (
    <span className="relative inline-flex shrink-0">
      {avatarUrl && !failed ? (
        <img src={avatarUrl} alt="" onError={() => setFailed(true)} className={cn('rounded-full border border-border object-cover', dim)} referrerPolicy="no-referrer" />
      ) : (
        <span aria-hidden className={cn('flex items-center justify-center rounded-full border border-border bg-surface-2 font-medium text-fg-2', dim)}>{initials}</span>
      )}
      <span className="absolute -bottom-0.5 -right-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full border border-border bg-surface text-fg-2">
        <PlatformIcon provider={provider} className="h-2.5 w-2.5" />
      </span>
    </span>
  );
}

export function accountName(a: { handle: string | null; displayName: string | null }): string {
  return a.handle ? `@${a.handle.replace(/^@/, '')}` : a.displayName ?? 'Unnamed account';
}
