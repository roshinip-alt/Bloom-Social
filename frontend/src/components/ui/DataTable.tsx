import { ArrowDown, ArrowUp } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/utils/cn';

export interface Column<T> {
  key: string;
  header: ReactNode;
  cell: (row: T) => ReactNode;
  align?: 'left' | 'right';
  sortable?: boolean;
  className?: string;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  caption: string;
  sort?: { key: string; direction: 'asc' | 'desc' };
  onSort?: (key: string) => void;
  onRowClick?: (row: T) => void;
  empty?: ReactNode;
  dense?: boolean;
}

/** Compact, semantic table. Sorting is controlled by the caller (server-side where data is paginated). */
export function DataTable<T>({ columns, rows, rowKey, caption, sort, onSort, onRowClick, empty, dense }: DataTableProps<T>) {
  return (
    <div className="relative overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr className="border-b border-border">
            {columns.map((c) => {
              const active = sort?.key === c.key;
              return (
                <th
                  key={c.key}
                  scope="col"
                  aria-sort={active ? (sort?.direction === 'asc' ? 'ascending' : 'descending') : undefined}
                  className={cn('whitespace-nowrap px-3 py-2 text-2xs font-medium uppercase tracking-wide text-fg-3', c.align === 'right' ? 'text-right' : 'text-left', c.className)}
                >
                  {c.sortable && onSort ? (
                    <button type="button" onClick={() => onSort(c.key)} className={cn('inline-flex items-center gap-1 uppercase hover:text-fg', active && 'text-fg')}>
                      {c.header}
                      {active && (sort?.direction === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />)}
                    </button>
                  ) : (
                    c.header
                  )}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && empty ? (
            <tr>
              <td colSpan={columns.length}>{empty}</td>
            </tr>
          ) : (
            rows.map((row) => (
              <tr
                key={rowKey(row)}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                onKeyDown={onRowClick ? (e) => { if (e.key === 'Enter') onRowClick(row); } : undefined}
                tabIndex={onRowClick ? 0 : undefined}
                className={cn('border-b border-border last:border-0', onRowClick && 'cursor-pointer hover:bg-surface-2/60 focus-visible:bg-surface-2')}
              >
                {columns.map((c) => (
                  <td key={c.key} className={cn('px-3', dense ? 'py-1.5' : 'py-2.5', c.align === 'right' && 'tabular text-right', c.className)}>
                    {c.cell(row)}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

export function Pagination({ page, totalPages, onChange }: { page: number; totalPages: number; onChange: (page: number) => void }) {
  if (totalPages <= 1) return null;
  return (
    <nav aria-label="Pagination" className="flex items-center justify-end gap-2 px-3 py-2 text-xs text-fg-2">
      <button type="button" className="h-7 rounded-md border border-border-strong px-2 disabled:opacity-40" disabled={page <= 0} onClick={() => onChange(page - 1)}>
        Previous
      </button>
      <span className="tabular">
        Page {page + 1} of {totalPages}
      </span>
      <button type="button" className="h-7 rounded-md border border-border-strong px-2 disabled:opacity-40" disabled={page >= totalPages - 1} onClick={() => onChange(page + 1)}>
        Next
      </button>
    </nav>
  );
}
