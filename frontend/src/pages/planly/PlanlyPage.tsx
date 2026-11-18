import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { ErrorState, PanelSkeleton, errorMessage } from '@/components/ui/Feedback';
import { Select } from '@/components/ui/FormControls';
import { IconButton } from '@/components/ui/IconButton';
import { Segmented } from '@/components/ui/Tabs';
import { useToast } from '@/hooks/useToast';
import { useUrlState } from '@/hooks/useUrlState';
import { PageHeader } from '@/layouts/PageHeader';
import { goalsApi, planlyApi } from '@/services/bloomApi';
import type { Task } from '@/types/api';
import { formatDay, monthGrid, shiftDate, todayLocal, weekDays } from '@/utils/dates';
import { PRIORITY_LABEL, TASK_STATUS_LABEL } from '@/utils/labels';
import { qk } from '@/utils/queryKeys';
import { AgendaView, MonthView, WeekView } from './CalendarViews';
import { DayPanel } from './DayPanel';
import { TaskDrawer } from './TaskDrawer';

type View = 'month' | 'week' | 'day' | 'agenda';

function windowFor(view: View, anchor: string): { from: string; to: string } {
  if (view === 'month') {
    const grid = monthGrid(anchor);
    return { from: grid[0]!, to: grid[grid.length - 1]! };
  }
  if (view === 'week') {
    const days = weekDays(anchor);
    return { from: days[0]!, to: days[6]! };
  }
  if (view === 'day') return { from: anchor, to: anchor };
  return { from: anchor, to: shiftDate(anchor, 13) };
}

export default function PlanlyPage() {
  const client = useQueryClient();
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const [view, setView] = useUrlState('view', 'week');
  const [anchor, setAnchor] = useUrlState('date', todayLocal());
  const [status, setStatus] = useUrlState('status', '');
  const [priority, setPriority] = useUrlState('priority', '');
  const [goalId, setGoalId] = useUrlState('goal', '');
  const [drawer, setDrawer] = useState<{ open: boolean; task: Task | null; date: string | null }>({ open: false, task: null, date: null });

  const v = (['month', 'week', 'day', 'agenda'].includes(view) ? view : 'week') as View;
  const range = windowFor(v, anchor);
  const q = { ...range, status: status || undefined, priority: priority || undefined, goalId: goalId || undefined };
  const calendar = useQuery({ queryKey: qk.calendar(q), queryFn: () => planlyApi.calendar(q), placeholderData: keepPreviousData });
  const goals = useQuery({ queryKey: qk.goals(['ACTIVE']), queryFn: () => goalsApi.list(['ACTIVE']) });
  const today = calendar.data?.today ?? todayLocal();

  useEffect(() => {
    if (params.get('new') === 'task') {
      setDrawer({ open: true, task: null, date: today });
      setParams((p) => { const n = new URLSearchParams(p); n.delete('new'); return n; }, { replace: true });
    }
  }, [params, setParams, today]);

  const toggle = useMutation({
    mutationFn: (t: Task) => planlyApi.setStatus(t.id, t.status === 'DONE' ? 'TODO' : 'DONE'),
    onSuccess: async (result) => {
      await client.invalidateQueries({ queryKey: ['planly'] });
      void client.invalidateQueries({ queryKey: ['dashboard'] });
      if (result.nextOccurrence?.dueDate) toast.success(`Done. Next occurrence scheduled for ${formatDay(result.nextOccurrence.dueDate, 'EEE d MMM')}.`);
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  const step = (dir: number) => {
    const days = v === 'month' ? 0 : v === 'week' ? 7 : v === 'day' ? 1 : 14;
    if (v === 'month') {
      const d = new Date(anchor + 'T00:00:00');
      d.setDate(1);
      d.setMonth(d.getMonth() + dir);
      setAnchor(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`);
    } else {
      setAnchor(shiftDate(anchor, dir * days));
    }
  };

  const title =
    v === 'month' ? formatDay(anchor, 'MMMM yyyy')
      : v === 'day' ? formatDay(anchor, 'EEEE d MMMM yyyy')
        : `${formatDay(range.from, 'd MMM')} – ${formatDay(range.to, 'd MMM yyyy')}`;

  const viewProps = calendar.data && {
    data: calendar.data,
    anchor,
    onOpenTask: (t: Task) => setDrawer({ open: true, task: t, date: t.dueDate }),
    onCreate: (date: string) => setDrawer({ open: true, task: null, date }),
    onOpenDay: (date: string) => { setView('day'); setAnchor(date); },
    onToggle: (t: Task) => toggle.mutateAsync(t),
  };

  return (
    <>
      <PageHeader
        title="Planly"
        description={calendar.data ? `Dates follow your workspace timezone (${calendar.data.timezone}).` : 'Plan your days, tasks and notes.'}
        actions={<Button variant="primary" onClick={() => setDrawer({ open: true, task: null, date: v === 'day' ? anchor : today })}><Plus /> New task</Button>}
      >
        <div className="flex flex-wrap items-center gap-2">
          <Segmented label="Calendar view" value={v} onChange={(x) => setView(x)} options={[
            { value: 'month', label: 'Month' }, { value: 'week', label: 'Week' }, { value: 'day', label: 'Day' }, { value: 'agenda', label: 'Agenda' },
          ]} />
          <div className="flex items-center gap-1">
            <IconButton label="Previous" icon={<ChevronLeft />} onClick={() => step(-1)} />
            <Button size="sm" onClick={() => setAnchor(today)}>Today</Button>
            <IconButton label="Next" icon={<ChevronRight />} onClick={() => step(1)} />
          </div>
          <span className="text-sm font-medium">{title}</span>
          <div className="ml-auto flex flex-wrap gap-2">
            <Select aria-label="Filter by status" value={status} onChange={(e) => setStatus(e.target.value)} className="w-32">
              <option value="">Any status</option>
              {Object.entries(TASK_STATUS_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </Select>
            <Select aria-label="Filter by priority" value={priority} onChange={(e) => setPriority(e.target.value)} className="w-32">
              <option value="">Any priority</option>
              {Object.entries(PRIORITY_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </Select>
            <Select aria-label="Filter by goal" value={goalId} onChange={(e) => setGoalId(e.target.value)} className="w-40">
              <option value="">Any goal</option>
              {(goals.data ?? []).map((g) => <option key={g.id} value={g.id}>{g.title}</option>)}
            </Select>
          </div>
        </div>
      </PageHeader>

      {v === 'day' && viewProps ? (
        <DayPanel date={anchor} onOpenTask={viewProps.onOpenTask} onCreate={viewProps.onCreate} onToggle={viewProps.onToggle} />
      ) : calendar.isLoading ? (
        <PanelSkeleton rows={6} />
      ) : calendar.error ? (
        <div className="panel"><ErrorState error={calendar.error} onRetry={() => calendar.refetch()} /></div>
      ) : viewProps ? (
        v === 'month' ? <MonthView {...viewProps} /> : v === 'agenda' ? <AgendaView {...viewProps} /> : <WeekView {...viewProps} />
      ) : null}

      <TaskDrawer open={drawer.open} onOpenChange={(open) => setDrawer((d) => ({ ...d, open }))} task={drawer.task} defaultDate={drawer.date} today={today} />
    </>
  );
}
