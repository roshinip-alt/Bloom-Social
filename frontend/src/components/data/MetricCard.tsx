import { ArrowDownRight, ArrowUpRight, Info, Minus } from 'lucide-react';
import type { ReactNode } from 'react';
import type { Unit } from '@/types/api';
import { cn } from '@/utils/cn';
import { formatChange, formatMetric } from '@/utils/format';
import { Tooltip } from '../ui/Tooltip';

interface MetricCardProps {
  label: string;
  value: number | null;
  unit: Unit;
  definition?: string;
  previousValue?: number | null;
  change?: number | null;
  comparisonLabel?: string;
  /** Shown instead of the value when it is null, e.g. "Not available from TikTok's API". */
  unavailableReason?: string;
  context?: ReactNode;
  footer?: ReactNode;
}

/** One headline number with its comparison and definition. Missing values show a reason, never 0. */
export function MetricCard({ label, value, unit, definition, previousValue, change, comparisonLabel, unavailableReason, context, footer }: MetricCardProps) {
  const delta = formatChange(change, previousValue, unit);
  return (
    <div className="panel flex min-w-0 flex-col gap-1.5 p-4">
      <div className="flex items-center gap-1.5">
        <h3 className="truncate text-xs font-medium text-fg-2">{label}</h3>
        {definition && (
          <Tooltip content={definition}>
            <button type="button" className="rounded text-fg-3 hover:text-fg" aria-label={`About ${label}: ${definition}`}>
              <Info className="h-3.5 w-3.5" />
            </button>
          </Tooltip>
        )}
        {context && <span className="ml-auto">{context}</span>}
      </div>
      {value === null ? (
        <p className="text-sm text-fg-2">{unavailableReason ?? 'Not available'}</p>
      ) : (
        <p className="tabular text-2xl font-semibold tracking-tight">{formatMetric(value, unit)}</p>
      )}
      {delta ? (
        <p className="tabular flex items-center gap-1 text-xs">
          <span className={cn('inline-flex items-center gap-0.5 font-medium', delta.direction === 'up' && 'text-accent', delta.direction === 'down' && 'text-danger', delta.direction === 'flat' && 'text-fg-2')}>
            {delta.direction === 'up' ? <ArrowUpRight className="h-3.5 w-3.5" aria-hidden /> : delta.direction === 'down' ? <ArrowDownRight className="h-3.5 w-3.5" aria-hidden /> : <Minus className="h-3.5 w-3.5" aria-hidden />}
            {delta.percent ?? delta.text}
          </span>
          <span className="text-fg-3">{comparisonLabel ?? 'vs previous period'}</span>
        </p>
      ) : value !== null ? (
        <p className="text-xs text-fg-3">No comparison for the previous period</p>
      ) : null}
      {footer && <div className="mt-1 border-t border-border pt-2 text-xs text-fg-2">{footer}</div>}
    </div>
  );
}
