import * as RadixTabs from '@radix-ui/react-tabs';
import type { ReactNode } from 'react';
import { cn } from '@/utils/cn';

export const Tabs = RadixTabs.Root;
export const TabsContent = RadixTabs.Content;

/** Underlined tab list (arrow-key navigable). */
export function TabsList({ items, className }: { items: { value: string; label: ReactNode; count?: number }[]; className?: string }) {
  return (
    <RadixTabs.List className={cn('flex gap-1 overflow-x-auto border-b border-border', className)}>
      {items.map((item) => (
        <RadixTabs.Trigger
          key={item.value}
          value={item.value}
          className="-mb-px inline-flex h-9 items-center gap-1.5 whitespace-nowrap border-b-2 border-transparent px-2.5 text-sm text-fg-2 transition-colors hover:text-fg data-[state=active]:border-accent data-[state=active]:font-medium data-[state=active]:text-fg"
        >
          {item.label}
          {item.count !== undefined && <span className="tabular rounded bg-surface-2 px-1.5 text-2xs text-fg-2">{item.count}</span>}
        </RadixTabs.Trigger>
      ))}
    </RadixTabs.List>
  );
}

/** Compact segmented control for switching views (e.g. Month / Week / Day). */
export function Segmented<T extends string>({ value, onChange, options, label }: { value: T; onChange: (v: T) => void; options: { value: T; label: string }[]; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex rounded-md border border-border-strong bg-surface p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn('h-7 rounded px-2.5 text-xs font-medium transition-colors', value === o.value ? 'bg-surface-2 text-fg shadow-panel' : 'text-fg-2 hover:text-fg')}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
