import type { ReactNode } from 'react';

/** Compact page heading (no marketing-size hero): title, one-line purpose, and page-level actions. */
export function PageHeader({ title, description, actions, children }: { title: string; description?: ReactNode; actions?: ReactNode; children?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-[32px] font-extrabold leading-tight tracking-tight">{title}</h1>
          {description && <p className="mt-1 text-base text-fg-2">{description}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
      {children}
    </div>
  );
}
