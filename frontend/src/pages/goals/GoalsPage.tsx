import { useQuery } from '@tanstack/react-query';
import { Plus, Target } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { GoalProgress, GoalStateBadge } from '@/components/data/GoalProgressRow';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { EmptyState, ErrorState, PanelSkeleton } from '@/components/ui/Feedback';
import { Tabs, TabsList } from '@/components/ui/Tabs';
import { useUrlState } from '@/hooks/useUrlState';
import { PageHeader } from '@/layouts/PageHeader';
import { goalsApi } from '@/services/bloomApi';
import type { Goal, GoalStatus } from '@/types/api';
import { formatDay } from '@/utils/dates';
import { GOAL_CATEGORY_LABEL, PROVIDER_LABEL } from '@/utils/labels';
import { qk } from '@/utils/queryKeys';
import { GoalDetail } from './GoalDetail';
import { GoalForm } from './GoalForm';

export default function GoalsPage() {
  const [params, setParams] = useSearchParams();
  const [tab, setTab] = useUrlState('tab', 'ACTIVE');
  const [selected, setSelected] = useUrlState('goal', '');
  const [form, setForm] = useState<{ open: boolean; goal: Goal | null }>({ open: false, goal: null });
  const query = useQuery({ queryKey: qk.goals(), queryFn: () => goalsApi.list() });

  useEffect(() => {
    if (params.get('new') === 'goal') {
      setForm({ open: true, goal: null });
      setParams((p) => { const n = new URLSearchParams(p); n.delete('new'); return n; }, { replace: true });
    }
  }, [params, setParams]);

  const goals = query.data ?? [];
  const byStatus = (s: GoalStatus) => goals.filter((g) => g.status === s);
  const shown = byStatus(tab as GoalStatus);
  const atRisk = byStatus('ACTIVE').filter((g) => g.state === 'AT_RISK' || g.state === 'OVERDUE').length;

  return (
    <>
      <PageHeader title="Goals" description={atRisk ? `${atRisk} active goal${atRisk > 1 ? 's need' : ' needs'} attention.` : 'Targets with milestones, history and honest progress.'}
        actions={<Button variant="primary" onClick={() => setForm({ open: true, goal: null })}><Plus /> New goal</Button>}>
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList items={[
            { value: 'ACTIVE', label: 'Active', count: byStatus('ACTIVE').length },
            { value: 'COMPLETED', label: 'Completed', count: byStatus('COMPLETED').length },
            { value: 'ARCHIVED', label: 'Archived', count: byStatus('ARCHIVED').length },
          ]} />
        </Tabs>
      </PageHeader>

      {query.isLoading ? <div className="grid gap-3 md:grid-cols-2">{[0, 1, 2, 3].map((i) => <PanelSkeleton key={i} rows={2} />)}</div>
        : query.error ? <div className="panel"><ErrorState error={query.error} onRetry={() => query.refetch()} /></div>
          : shown.length === 0 ? (
            <div className="panel">
              <EmptyState icon={Target} title={tab === 'ACTIVE' ? 'No active goals' : `No ${tab.toLowerCase()} goals`}
                description={tab === 'ACTIVE' ? 'Set a target with a deadline. Track it manually or link it to a synced metric.' : undefined}
                action={tab === 'ACTIVE' ? <Button variant="primary" onClick={() => setForm({ open: true, goal: null })}><Plus /> New goal</Button> : undefined} />
            </div>
          ) : (
            <ul className="grid gap-3 md:grid-cols-2">
              {shown.map((g) => (
                <li key={g.id}>
                  <button type="button" onClick={() => setSelected(g.id)} className="panel flex w-full flex-col gap-2 p-4 text-left transition-colors hover:border-border-strong">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold">{g.title}</p>
                        <p className="text-2xs text-fg-3">{GOAL_CATEGORY_LABEL[g.category]}{g.deadline ? ` · due ${formatDay(g.deadline, 'd MMM yyyy')}` : ''}</p>
                      </div>
                      <GoalStateBadge state={g.state} />
                    </div>
                    <GoalProgress goal={g} />
                    <div className="flex flex-wrap items-center gap-1.5 text-2xs text-fg-2">
                      {g.progressSource === 'ANALYTICS' && g.linkedMetric
                        ? <Badge tone="info">Synced · {g.linkedMetric.provider ? PROVIDER_LABEL[g.linkedMetric.provider] : ''} {g.linkedMetric.label}</Badge>
                        : <Badge tone="outline">Manual</Badge>}
                      {g.milestones.length > 0 && <span>{g.milestones.filter((m) => m.achievedAt).length}/{g.milestones.length} milestones</span>}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}

      <GoalDetail goalId={selected || null} onClose={() => setSelected(null)} onEdit={(g) => setForm({ open: true, goal: g })} />
      <GoalForm open={form.open} onOpenChange={(open) => setForm((f) => ({ ...f, open }))} goal={form.goal} onSaved={(g) => setSelected(g.id)} />
    </>
  );
}
