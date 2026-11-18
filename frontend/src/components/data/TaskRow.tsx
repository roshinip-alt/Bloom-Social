import { Repeat, Target } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { Task } from '@/types/api';
import { cn } from '@/utils/cn';
import { formatDay } from '@/utils/dates';
import { PRIORITY_LABEL } from '@/utils/labels';

const PRIORITY_DOT = { LOW: 'bg-fg-3/50', MEDIUM: 'bg-info', HIGH: 'bg-warning', URGENT: 'bg-danger' } as const;

/** A task line: completion checkbox, title, priority (dot + text for screen readers), due info and links. */
export function TaskRow({ task, onToggle, onOpen, showDate = true }: {
  task: Task;
  /** May return a promise; the checkbox flips immediately and reverts if it rejects. */
  onToggle?: (task: Task) => unknown;
  onOpen?: (task: Task) => void;
  showDate?: boolean;
}) {
  const [optimistic, setOptimistic] = useState<boolean | null>(null);
  useEffect(() => setOptimistic(null), [task.status]);
  const done = optimistic ?? task.status === 'DONE';
  const toggle = () => {
    setOptimistic(!done);
    Promise.resolve(onToggle?.(task)).catch(() => setOptimistic(null));
  };
  return (
    <div className="group flex items-start gap-2.5 py-1.5">
      {onToggle && (
        <input
          type="checkbox"
          checked={done}
          onChange={toggle}
          aria-label={done ? `Mark "${task.title}" as not done` : `Mark "${task.title}" as done`}
          className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer rounded border-border-strong accent-[rgb(var(--accent))]"
        />
      )}
      <button type="button" onClick={() => onOpen?.(task)} disabled={!onOpen} className="min-w-0 flex-1 text-left disabled:cursor-default">
        <span className={cn('flex items-center gap-1.5 text-sm', done && 'text-fg-3 line-through')}>
          <span aria-hidden className={cn('h-1.5 w-1.5 shrink-0 rounded-full', PRIORITY_DOT[task.priority])} />
          <span className="sr-only">{PRIORITY_LABEL[task.priority]} priority:</span>
          <span className="truncate">{task.title}</span>
          {task.recurrence !== 'NONE' && <Repeat className="h-3 w-3 shrink-0 text-fg-3" aria-label="Repeats" />}
        </span>
        <span className="mt-0.5 flex flex-wrap gap-x-2 text-2xs text-fg-3">
          {showDate && task.dueDate && (
            <span className={cn(task.overdue && 'font-medium text-danger')}>
              {task.overdue ? 'Overdue · ' : ''}
              {formatDay(task.dueDate, 'EEE d MMM')}
              {task.dueTime ? ` · ${task.dueTime.slice(0, 5)}` : ''}
            </span>
          )}
          {!showDate && task.dueTime && <span>{task.dueTime.slice(0, 5)}</span>}
          {task.goalTitle && (
            <span className="inline-flex items-center gap-0.5"><Target className="h-3 w-3" aria-hidden />{task.goalTitle}</span>
          )}
          {task.subtasks.length > 0 && (
            <span className="tabular">{task.subtasks.filter((s) => s.done).length}/{task.subtasks.length} subtasks</span>
          )}
        </span>
      </button>
    </div>
  );
}
