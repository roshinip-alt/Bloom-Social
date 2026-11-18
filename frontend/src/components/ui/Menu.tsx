import * as Dropdown from '@radix-ui/react-dropdown-menu';
import type { ReactNode } from 'react';
import { cn } from '@/utils/cn';

export interface MenuItem {
  label: string;
  icon?: ReactNode;
  onSelect: () => void;
  destructive?: boolean;
  disabled?: boolean;
}

/** Dropdown menu of real actions (keyboard navigable). Every item must do something. */
export function Menu({ trigger, items, align = 'end', label }: { trigger: ReactNode; items: (MenuItem | 'separator')[]; align?: 'start' | 'end'; label?: string }) {
  return (
    <Dropdown.Root>
      <Dropdown.Trigger asChild>{trigger}</Dropdown.Trigger>
      <Dropdown.Portal>
        <Dropdown.Content align={align} sideOffset={4} aria-label={label} className="z-[60] min-w-[180px] rounded-lg border border-border bg-surface p-1 shadow-overlay">
          {items.map((item, i) =>
            item === 'separator' ? (
              <Dropdown.Separator key={i} className="my-1 h-px bg-border" />
            ) : (
              <Dropdown.Item
                key={item.label}
                disabled={item.disabled}
                onSelect={item.onSelect}
                className={cn(
                  'flex h-8 cursor-pointer select-none items-center gap-2 rounded-md px-2 text-sm outline-none data-[disabled]:pointer-events-none data-[highlighted]:bg-surface-2 data-[disabled]:opacity-50 [&_svg]:h-4 [&_svg]:w-4',
                  item.destructive ? 'text-danger' : 'text-fg',
                )}
              >
                {item.icon}
                {item.label}
              </Dropdown.Item>
            ),
          )}
        </Dropdown.Content>
      </Dropdown.Portal>
    </Dropdown.Root>
  );
}
