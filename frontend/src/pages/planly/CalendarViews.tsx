import { Plus, StickyNote } from 'lucide-react';
import { TaskRow } from '@/components/data/TaskRow';
import type { CalendarView, Task } from '@/types/api';
import { cn } from '@/utils/cn';
import { formatDay, isSameMonth, monthGrid, shiftDate, weekDays } from '@/utils/dates';

interface ViewProps {
  data: CalendarView;
  anchor: string;
  onOpenTask: (t: Task) => void;
  onCreate: (date: string) => void;
  onOpenDay: (date: string) => void;
  onToggle: (t: Task) => unknown;
}

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function tasksOn(data: CalendarView, date: string) {
  return data.tasks.filter((t) => t.dueDate === date);
}

export function MonthView({ data, anchor, onOpenTask, onCreate, onOpenDay }: ViewProps) {
  const days = monthGrid(anchor);
  const byDate = new Map(data.days.map((d) => [d.date, d]));
  return (
    <div className="panel overflow-hidden">
      <div className="grid grid-cols-7 border-b border-border bg-surface-2/50">
        {WEEKDAYS.map((d) => <div key={d} className="px-2 py-1.5 text-2xs font-medium uppercase text-fg-3">{d}</div>)}
      </div>
      <div className="grid grid-cols-7">
        {days.map((date) => {
          const tasks = tasksOn(data, date);
          const info = byDate.get(date);
          const outside = !isSameMonth(date, anchor);
          return (
            <div key={date} className={cn('group relative min-h-[96px] border-b border-r border-border p-1.5 [&:nth-child(7n)]:border-r-0', outside && 'bg-surface-2/40')}>
              <div className="flex items-center justify-between">
                <button type="button" onClick={() => onOpenDay(date)} aria-label={`Open ${formatDay(date, 'EEEE d MMMM')}`}
                  className={cn('tabular flex h-6 min-w-6 items-center justify-center rounded px-1 text-xs hover:bg-surface-2', date === data.today && 'bg-accent font-semibold text-accent-fg hover:bg-accent-hover', outside && 'text-fg-3')}>
                  {formatDay(date, 'd')}
                </button>
                <span className="flex items-center gap-1">
                  {info?.hasNote && <StickyNote className="h-3 w-3 text-fg-3" aria-label="Has notes" />}
                  <button type="button" onClick={() => onCreate(date)} aria-label={`Add task on ${formatDay(date, 'd MMMM')}`}
                    className="rounded p-0.5 text-fg-3 opacity-0 hover:bg-surface-2 hover:text-fg focus-visible:opacity-100 group-hover:opacity-100">
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                </span>
              </div>
              {info?.focus && <p className="mt-0.5 truncate text-2xs italic text-fg-3" title={info.focus}>{info.focus}</p>}
              <ul className="mt-1 space-y-0.5">
                {tasks.slice(0, 3).map((t) => (
                  <li key={t.id}>
                    <button type="button" onClick={() => onOpenTask(t)}
                      className={cn('block w-full truncate rounded px-1 py-0.5 text-left text-2xs hover:bg-surface-2', t.status === 'DONE' ? 'text-fg-3 line-through' : 'bg-accent-soft/70 text-fg', t.overdue && 'bg-danger-soft')}>
                      {t.dueTime ? `${t.dueTime.slice(0, 5)} ` : ''}{t.title}
                    </button>
                  </li>
                ))}
                {tasks.length > 3 && (
                  <li><button type="button" onClick={() => onOpenDay(date)} className="px-1 text-2xs text-fg-2 hover:underline">+{tasks.length - 3} more</button></li>
                )}
              </ul>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function WeekView({ data, anchor, onOpenTask, onCreate, onOpenDay, onToggle }: ViewProps) {
  return (
    <div className="grid gap-2 md:grid-cols-7">
      {weekDays(anchor).map((date) => {
        const tasks = tasksOn(data, date);
        const info = data.days.find((d) => d.date === date);
        return (
          <section key={date} className={cn('panel flex min-h-[180px] flex-col p-2', date === data.today && 'border-accent/50')}>
            <header className="mb-1 flex items-center justify-between">
              <button type="button" onClick={() => onOpenDay(date)} className="text-left text-xs font-medium hover:underline">
                {formatDay(date, 'EEE d')}{date === data.today && <span className="ml-1 text-accent">Today</span>}
              </button>
              <button type="button" onClick={() => onCreate(date)} aria-label={`Add task on ${formatDay(date, 'EEEE d MMMM')}`} className="rounded p-0.5 text-fg-3 hover:bg-surface-2 hover:text-fg">
                <Plus className="h-3.5 w-3.5" />
              </button>
            </header>
            {info?.focus && <p className="mb-1 line-clamp-2 text-2xs italic text-fg-3">{info.focus}</p>}
            <div className="flex-1 divide-y divide-border">
              {tasks.map((t) => <TaskRow key={t.id} task={t} showDate={false} onOpen={onOpenTask} onToggle={onToggle} />)}
              {tasks.length === 0 && <p className="py-2 text-2xs text-fg-3">Free</p>}
            </div>
          </section>
        );
      })}
    </div>
  );
}

export function AgendaView({ data, onOpenTask, onCreate, onToggle }: ViewProps) {
  const dates: string[] = [];
  for (let d = data.from; d <= data.to; d = shiftDate(d, 1)) dates.push(d);
  const withTasks = dates.filter((d) => tasksOn(data, d).length > 0);
  return (
    <div className="space-y-4">
      {data.overdue.length > 0 && (
        <section className="panel border-danger/30 p-4">
          <h3 className="text-sm font-semibold text-danger">Overdue</h3>
          <div className="divide-y divide-border">{data.overdue.map((t) => <TaskRow key={t.id} task={t} onOpen={onOpenTask} onToggle={onToggle} />)}</div>
        </section>
      )}
      <section className="panel divide-y divide-border">
        {withTasks.length === 0 && <p className="p-6 text-center text-sm text-fg-2">Nothing scheduled in the next two weeks.</p>}
        {withTasks.map((date) => (
          <div key={date} className="grid gap-2 p-3 sm:grid-cols-[140px_1fr]">
            <div className="flex items-start justify-between sm:block">
              <p className="text-sm font-medium">{formatDay(date, 'EEE d MMM')}</p>
              {date === data.today && <p className="text-2xs text-accent">Today</p>}
              <button type="button" onClick={() => onCreate(date)} className="text-2xs text-fg-3 hover:text-fg hover:underline">Add task</button>
            </div>
            <div className="divide-y divide-border">{tasksOn(data, date).map((t) => <TaskRow key={t.id} task={t} showDate={false} onOpen={onOpenTask} onToggle={onToggle} />)}</div>
          </div>
        ))}
      </section>
      {data.undated.length > 0 && (
        <section className="panel p-4">
          <h3 className="text-sm font-semibold">No date</h3>
          <p className="text-2xs text-fg-3">Open a task to schedule it.</p>
          <div className="divide-y divide-border">{data.undated.map((t) => <TaskRow key={t.id} task={t} onOpen={onOpenTask} onToggle={onToggle} />)}</div>
        </section>
      )}
    </div>
  );
}
