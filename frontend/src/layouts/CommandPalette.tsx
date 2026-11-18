import * as RadixDialog from '@radix-ui/react-dialog';
import { CornerDownLeft, Plus, Search } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/utils/cn';
import { PRIMARY_NAV, SECONDARY_NAV } from './navigation';

export const QUICK_ACTIONS = [
  { label: 'New task', to: '/planly?new=task' },
  { label: 'New goal', to: '/goals?new=goal' },
  { label: 'New content idea', to: '/content-studio?new=idea' },
  { label: 'New draft', to: '/content-studio?new=draft' },
  { label: 'New campaign', to: '/brand-earnings?new=campaign' },
];

/** ⌘K / Ctrl+K: jump to any page or start a common action from the keyboard. */
export function CommandPalette({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);

  const items = useMemo(() => {
    const all = [
      ...QUICK_ACTIONS.map((a) => ({ ...a, group: 'Create', icon: Plus })),
      ...[...PRIMARY_NAV, ...SECONDARY_NAV].map((n) => ({ label: n.label, to: n.to, group: 'Go to', icon: n.icon })),
    ];
    const q = query.trim().toLowerCase();
    return q ? all.filter((i) => i.label.toLowerCase().includes(q)) : all;
  }, [query]);

  useEffect(() => {
    if (open) {
      setQuery('');
      setActive(0);
    }
  }, [open]);

  const run = (index: number) => {
    const item = items[index];
    if (!item) return;
    onOpenChange(false);
    navigate(item.to);
  };

  return (
    <RadixDialog.Root open={open} onOpenChange={onOpenChange}>
      <RadixDialog.Portal>
        <RadixDialog.Overlay className="fixed inset-0 z-50 bg-black/30" />
        <RadixDialog.Content className="fixed left-1/2 top-[15vh] z-50 w-[calc(100vw-2rem)] max-w-lg -translate-x-1/2 overflow-hidden rounded-xl border border-border bg-surface shadow-overlay">
          <RadixDialog.Title className="sr-only">Command menu</RadixDialog.Title>
          <RadixDialog.Description className="sr-only">Search pages and actions</RadixDialog.Description>
          <div className="flex items-center gap-2 border-b border-border px-3">
            <Search className="h-4 w-4 text-fg-3" aria-hidden />
            <input
              autoFocus
              value={query}
              onChange={(e) => { setQuery(e.target.value); setActive(0); }}
              onKeyDown={(e) => {
                if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(a + 1, items.length - 1)); }
                if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
                if (e.key === 'Enter') { e.preventDefault(); run(active); }
              }}
              placeholder="Search pages and actions…"
              aria-label="Search pages and actions"
              role="combobox"
              aria-expanded
              aria-controls="command-results"
              aria-activedescendant={items[active] ? `cmd-${active}` : undefined}
              className="h-11 flex-1 bg-transparent text-sm outline-none placeholder:text-fg-3"
            />
          </div>
          <ul id="command-results" role="listbox" className="max-h-80 overflow-y-auto p-1.5">
            {items.length === 0 && <li className="px-3 py-6 text-center text-sm text-fg-2">No matches</li>}
            {items.map((item, i) => (
              <li
                key={item.group + item.label}
                id={`cmd-${i}`}
                role="option"
                aria-selected={i === active}
                onMouseEnter={() => setActive(i)}
                onClick={() => run(i)}
                className={cn('flex h-9 cursor-pointer items-center gap-2.5 rounded-md px-2.5 text-sm', i === active ? 'bg-surface-2 text-fg' : 'text-fg-2')}
              >
                <item.icon className="h-4 w-4" aria-hidden />
                <span className="flex-1">{item.label}</span>
                <span className="text-2xs text-fg-3">{item.group}</span>
                {i === active && <CornerDownLeft className="h-3.5 w-3.5 text-fg-3" aria-hidden />}
              </li>
            ))}
          </ul>
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  );
}
