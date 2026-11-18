import { Table2 } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { relativeTime } from '@/utils/dates';
import { IconButton } from '../ui/IconButton';

interface ChartPanelProps {
  title: string;
  description?: ReactNode;
  /** Data provenance shown under the chart: source, last successful sync, coverage. */
  meta?: ReactNode;
  lastSyncedAt?: string | null;
  actions?: ReactNode;
  legend?: ReactNode;
  table?: ReactNode;
  children: ReactNode;
}

/** Frame for every chart: title, definition, legend, provenance and an accessible table view. */
export function ChartPanel({ title, description, meta, lastSyncedAt, actions, legend, table, children }: ChartPanelProps) {
  const [showTable, setShowTable] = useState(false);
  return (
    <section className="panel flex min-w-0 flex-col">
      <header className="flex flex-wrap items-start gap-2 px-4 pt-3.5">
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold">{title}</h3>
          {description && <p className="mt-0.5 text-xs text-fg-2">{description}</p>}
        </div>
        <div className="flex items-center gap-1">
          {actions}
          {table && (
            <IconButton
              size="sm"
              label={showTable ? 'Show chart' : 'Show data table'}
              icon={<Table2 />}
              aria-pressed={showTable}
              onClick={() => setShowTable((v) => !v)}
            />
          )}
        </div>
      </header>
      {legend && <div className="px-4 pt-2">{legend}</div>}
      <div className="min-w-0 px-2 pb-2 pt-2">{showTable && table ? <div className="max-h-72 overflow-auto px-2">{table}</div> : children}</div>
      {(meta || lastSyncedAt !== undefined) && (
        <footer className="flex flex-wrap gap-x-3 gap-y-1 border-t border-border px-4 py-2 text-2xs text-fg-3">
          {meta}
          {lastSyncedAt !== undefined && <span>Last synced {relativeTime(lastSyncedAt)}</span>}
        </footer>
      )}
    </section>
  );
}

/** Legend for ≥2 series: swatch + text label (text in ink colors, never the series color). */
export function Legend({ items }: { items: { label: string; color: string }[] }) {
  if (items.length < 2) return null;
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1" aria-label="Legend">
      {items.map((i) => (
        <li key={i.label} className="inline-flex items-center gap-1.5 text-xs text-fg-2">
          <span aria-hidden className="h-2 w-3 rounded-sm" style={{ background: i.color }} />
          {i.label}
        </li>
      ))}
    </ul>
  );
}
