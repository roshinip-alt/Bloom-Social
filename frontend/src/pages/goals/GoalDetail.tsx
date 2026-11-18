import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Archive, CheckCircle2, MoreHorizontal, Pencil, Plus, RotateCcw, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { TrendChart } from '@/components/charts/TrendChart';
import { GoalProgress, GoalStateBadge } from '@/components/data/GoalProgressRow';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog, Drawer } from '@/components/ui/Dialog';
import { Alert, ErrorState, PanelSkeleton, errorMessage } from '@/components/ui/Feedback';
import { Input } from '@/components/ui/FormControls';
import { IconButton } from '@/components/ui/IconButton';
import { Menu } from '@/components/ui/Menu';
import { useToast } from '@/hooks/useToast';
import { goalsApi } from '@/services/bloomApi';
import type { Goal, Milestone } from '@/types/api';
import { formatDay, formatInstant } from '@/utils/dates';
import { formatNumber } from '@/utils/format';
import { GOAL_CATEGORY_LABEL, PROVIDER_LABEL } from '@/utils/labels';
import { qk } from '@/utils/queryKeys';

export function GoalDetail({ goalId, onClose, onEdit }: { goalId: string | null; onClose: () => void; onEdit: (g: Goal) => void }) {
  const client = useQueryClient();
  const toast = useToast();
  const open = Boolean(goalId);
  const goal = useQuery({ queryKey: qk.goal(goalId ?? ''), queryFn: () => goalsApi.get(goalId!), enabled: open });
  const history = useQuery({ queryKey: qk.goalHistory(goalId ?? ''), queryFn: () => goalsApi.history(goalId!), enabled: open });
  const [value, setValue] = useState('');
  const [note, setNote] = useState('');
  const [milestone, setMilestone] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);

  const refresh = async () => {
    await client.invalidateQueries({ queryKey: ['goals'] });
    void client.invalidateQueries({ queryKey: ['dashboard'] });
  };
  const action = useMutation({
    mutationFn: (kind: 'complete' | 'archive' | 'reopen') => goalsApi[kind](goalId!),
    onSuccess: async (_g, kind) => { await refresh(); toast.success(kind === 'complete' ? 'Goal completed' : kind === 'archive' ? 'Goal archived' : 'Goal reopened'); },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const progress = useMutation({
    mutationFn: () => goalsApi.recordProgress(goalId!, Number(value), note || undefined),
    onSuccess: async () => { setValue(''); setNote(''); await refresh(); toast.success('Progress recorded'); },
  });
  const milestoneMutation = useMutation({
    mutationFn: async (a: { type: 'add' } | { type: 'toggle'; m: Milestone } | { type: 'delete'; m: Milestone }) => {
      if (a.type === 'add') return goalsApi.addMilestone(goalId!, { title: milestone.trim() });
      if (a.type === 'toggle') return goalsApi.updateMilestone(goalId!, { id: a.m.id, title: a.m.title, targetValue: a.m.targetValue, dueDate: a.m.dueDate, achieved: !a.m.achievedAt });
      return goalsApi.deleteMilestone(goalId!, a.m.id);
    },
    onSuccess: async (_r, a) => { if (a.type === 'add') setMilestone(''); await refresh(); },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const remove = useMutation({
    mutationFn: () => goalsApi.remove(goalId!),
    onSuccess: async () => { setConfirmDelete(false); onClose(); await refresh(); toast.success('Goal deleted'); },
  });

  const g = goal.data;
  const points = [...(history.data ?? [])].reverse().map((e) => ({ date: e.recordedAt.slice(0, 10), value: e.value }));

  return (
    <Drawer open={open} onOpenChange={(o) => !o && onClose()} title={g?.title ?? 'Goal'} width="lg"
      description={g ? `${GOAL_CATEGORY_LABEL[g.category]} · started ${formatDay(g.startDate, 'd MMM yyyy')}${g.deadline ? ` · due ${formatDay(g.deadline, 'd MMM yyyy')}` : ''}` : undefined}
      footer={g && (
        <>
          <Menu label="Goal actions" align="start" trigger={<Button variant="ghost" className="mr-auto"><MoreHorizontal /> More</Button>} items={[
            { label: 'Edit goal', icon: <Pencil />, onSelect: () => onEdit(g) },
            g.status !== 'ARCHIVED' ? { label: 'Archive', icon: <Archive />, onSelect: () => action.mutate('archive') } : { label: 'Restore', icon: <RotateCcw />, onSelect: () => action.mutate('reopen') },
            'separator',
            { label: 'Delete goal', icon: <Trash2 />, destructive: true, onSelect: () => setConfirmDelete(true) },
          ]} />
          {g.status === 'ACTIVE'
            ? <Button variant="primary" loading={action.isPending} onClick={() => action.mutate('complete')}><CheckCircle2 /> Mark complete</Button>
            : <Button loading={action.isPending} onClick={() => action.mutate('reopen')}><RotateCcw /> Reopen</Button>}
        </>
      )}>
      {goal.isLoading ? <PanelSkeleton /> : goal.error || !g ? <ErrorState error={goal.error} onRetry={() => goal.refetch()} /> : (
        <div className="space-y-5">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <GoalStateBadge state={g.state} />
              {g.progressSource === 'ANALYTICS'
                ? <Badge tone="info">Synced metric</Badge>
                : <Badge tone="outline">Manual progress</Badge>}
              {g.daysRemaining !== null && g.status === 'ACTIVE' && (
                <span className="text-xs text-fg-2">{g.daysRemaining >= 0 ? `${g.daysRemaining} days left` : `${-g.daysRemaining} days past deadline`}</span>
              )}
            </div>
            <GoalProgress goal={g} />
            {g.targetReached && g.status === 'ACTIVE' && <Alert tone="accent">Target reached — mark the goal complete when you're ready.</Alert>}
            {g.description && <p className="text-sm text-fg-2">{g.description}</p>}
            {g.linkedMetric && (
              <p className="text-xs text-fg-2">
                Source: {g.linkedMetric.provider ? PROVIDER_LABEL[g.linkedMetric.provider] : 'analytics'} · {g.linkedMetric.accountHandle ? `@${g.linkedMetric.accountHandle} · ` : ''}{g.linkedMetric.label}
                {g.linkedMetric.measureType === 'FLOW' ? ' (summed since the start date)' : ' (latest synced value)'}
              </p>
            )}
            {g.linkedMetric?.note && <Alert tone="warning">{g.linkedMetric.note}</Alert>}
          </div>

          <section>
            <h3 className="label mb-2">Progress history</h3>
            {points.length >= 2 && <TrendChart unit="COUNT" height={160} series={[{ key: 'progress', label: g.unit, points }]} />}
            {g.progressSource === 'MANUAL' && g.status === 'ACTIVE' && (
              <form className="mt-2 flex flex-wrap gap-2" onSubmit={(e) => { e.preventDefault(); progress.mutate(); }}>
                <Input type="number" step="any" required aria-label={`New value in ${g.unit}`} placeholder={`Current ${g.unit}`} value={value} onChange={(e) => setValue(e.target.value)} className="w-36" />
                <Input aria-label="Note (optional)" placeholder="Note (optional)" value={note} maxLength={500} onChange={(e) => setNote(e.target.value)} className="min-w-[160px] flex-1" />
                <Button type="submit" variant="primary" loading={progress.isPending} disabled={value === ''}>Record</Button>
                {progress.error ? <p className="w-full text-xs text-danger">{errorMessage(progress.error)}</p> : null}
              </form>
            )}
            <ul className="mt-3 divide-y divide-border">
              {(history.data ?? []).slice(0, 12).map((e) => (
                <li key={e.id} className="flex items-center gap-2 py-1.5 text-sm">
                  <span className="tabular w-24 font-medium">{formatNumber(e.value)}</span>
                  <span className="flex-1 truncate text-fg-2">{e.note ?? ''}</span>
                  <Badge tone={e.source === 'ANALYTICS' ? 'info' : 'neutral'}>{e.source === 'ANALYTICS' ? 'Synced' : 'Manual'}</Badge>
                  <span className="text-2xs text-fg-3">{formatInstant(e.recordedAt, 'd MMM yyyy')}</span>
                </li>
              ))}
              {history.data?.length === 0 && <li className="py-2 text-sm text-fg-2">No progress recorded yet.</li>}
            </ul>
          </section>

          <section>
            <h3 className="label mb-2">Milestones</h3>
            <ul className="space-y-1">
              {g.milestones.map((m) => (
                <li key={m.id} className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={Boolean(m.achievedAt)} onChange={() => milestoneMutation.mutate({ type: 'toggle', m })} aria-label={`Milestone ${m.title} achieved`} className="h-4 w-4 accent-[rgb(var(--accent))]" />
                  <span className={m.achievedAt ? 'flex-1 text-fg-3 line-through' : 'flex-1'}>{m.title}</span>
                  {m.targetValue !== null && <span className="tabular text-xs text-fg-2">{formatNumber(m.targetValue)}</span>}
                  {m.dueDate && <span className="text-2xs text-fg-3">{formatDay(m.dueDate)}</span>}
                  <IconButton size="sm" label={`Delete milestone ${m.title}`} icon={<Trash2 />} onClick={() => milestoneMutation.mutate({ type: 'delete', m })} />
                </li>
              ))}
            </ul>
            <form className="mt-2 flex gap-2" onSubmit={(e) => { e.preventDefault(); if (milestone.trim()) milestoneMutation.mutate({ type: 'add' }); }}>
              <Input aria-label="New milestone" placeholder="Add a milestone" value={milestone} maxLength={200} onChange={(e) => setMilestone(e.target.value)} />
              <Button type="submit" disabled={!milestone.trim()}><Plus /> Add</Button>
            </form>
          </section>
        </div>
      )}
      <ConfirmDialog open={confirmDelete} onOpenChange={setConfirmDelete} title="Delete this goal?" description="Its milestones and progress history are deleted. Linked tasks and drafts stay, without the link."
        confirmLabel="Delete goal" loading={remove.isPending} onConfirm={() => remove.mutate()} />
    </Drawer>
  );
}
