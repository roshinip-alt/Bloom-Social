import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { accountName } from '@/components/data/AccountAvatar';
import { Button } from '@/components/ui/Button';
import { Drawer } from '@/components/ui/Dialog';
import { Alert, errorMessage } from '@/components/ui/Feedback';
import { FormField, Input, Select, Textarea } from '@/components/ui/FormControls';
import { Segmented } from '@/components/ui/Tabs';
import { useToast } from '@/hooks/useToast';
import { ApiError } from '@/services/apiClient';
import { accountsApi, analyticsApi, goalsApi } from '@/services/bloomApi';
import type { Goal, GoalCategory, GoalInput } from '@/types/api';
import { todayLocal } from '@/utils/dates';
import { GOAL_CATEGORY_LABEL, PROVIDER_LABEL } from '@/utils/labels';
import { qk } from '@/utils/queryKeys';

const blank = (): GoalInput => ({
  title: '', category: 'AUDIENCE', description: '', unit: '', startValue: 0, targetValue: 0, startDate: todayLocal(), deadline: null,
  progressSource: 'MANUAL', linkedAccountId: null, linkedMetricKey: null,
});

/** Create or edit a goal. Analytics-linked progress is offered only for metrics that exist for the chosen account. */
export function GoalForm({ open, onOpenChange, goal, onSaved }: { open: boolean; onOpenChange: (o: boolean) => void; goal: Goal | null; onSaved?: (g: Goal) => void }) {
  const client = useQueryClient();
  const toast = useToast();
  const [form, setForm] = useState<GoalInput>(blank());
  const accounts = useQuery({ queryKey: qk.accounts, queryFn: accountsApi.list, enabled: open });
  const definitions = useQuery({ queryKey: qk.metricDefinitions, queryFn: () => analyticsApi.metrics(), enabled: open });

  useEffect(() => {
    if (!open) return;
    setForm(goal ? {
      title: goal.title, category: goal.category, description: goal.description ?? '', unit: goal.unit, startValue: goal.startValue,
      targetValue: goal.targetValue, startDate: goal.startDate, deadline: goal.deadline, progressSource: goal.progressSource,
      linkedAccountId: goal.linkedMetric?.accountId ?? null, linkedMetricKey: goal.linkedMetric?.metricKey ?? null,
    } : blank());
  }, [open, goal]);

  const linkable = (accounts.data ?? []).filter((a) => a.capabilities.includes('ACCOUNT_METRICS') && a.connectionStatus !== 'DISCONNECTED');
  const account = linkable.find((a) => a.id === form.linkedAccountId);
  const metrics = useMemo(
    () => (definitions.data ?? []).filter((d) => account && d.provider === account.provider && d.scope === 'ACCOUNT' && !d.canonicalKey.includes('avg')),
    [definitions.data, account],
  );

  const save = useMutation({
    mutationFn: () => {
      const body: GoalInput = { ...form, description: form.description || null, deadline: form.deadline || null };
      if (body.progressSource === 'MANUAL') { body.linkedAccountId = null; body.linkedMetricKey = null; }
      return goal ? goalsApi.update(goal.id, body) : goalsApi.create(body);
    },
    onSuccess: async (saved) => {
      await client.invalidateQueries({ queryKey: ['goals'] });
      void client.invalidateQueries({ queryKey: ['dashboard'] });
      toast.success(goal ? 'Goal updated' : 'Goal created');
      onSaved?.(saved);
      onOpenChange(false);
    },
  });

  const set = <K extends keyof GoalInput>(k: K, v: GoalInput[K]) => setForm((f) => ({ ...f, [k]: v }));
  const fe = (f: string) => (save.error instanceof ApiError ? save.error.fieldError(f) : undefined);
  const submit = (e: FormEvent) => { e.preventDefault(); save.mutate(); };

  return (
    <Drawer open={open} onOpenChange={onOpenChange} title={goal ? 'Edit goal' : 'New goal'}
      footer={<><Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button><Button variant="primary" type="submit" form="goal-form" loading={save.isPending}>{goal ? 'Save changes' : 'Create goal'}</Button></>}>
      <form id="goal-form" onSubmit={submit} className="space-y-4">
        {save.error && !(save.error instanceof ApiError && save.error.fieldErrors.length) ? <Alert tone="danger">{errorMessage(save.error)}</Alert> : null}
        <FormField label="Title" required error={fe('title')}>{(p) => <Input {...p} autoFocus required maxLength={200} value={form.title} onChange={(e) => set('title', e.target.value)} placeholder="e.g. Reach 25k subscribers" />}</FormField>
        <div className="grid grid-cols-2 gap-3">
          <FormField label="Category">{(p) => (
            <Select {...p} value={form.category} onChange={(e) => set('category', e.target.value as GoalCategory)}>
              {Object.entries(GOAL_CATEGORY_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </Select>
          )}</FormField>
          <FormField label="Unit" required error={fe('unit')} hint="e.g. followers, videos, USD">{(p) => <Input {...p} required maxLength={48} value={form.unit} onChange={(e) => set('unit', e.target.value)} />}</FormField>
        </div>
        <FormField label="Description">{(p) => <Textarea {...p} rows={2} value={form.description ?? ''} onChange={(e) => set('description', e.target.value)} />}</FormField>

        <fieldset className="space-y-2">
          <legend className="text-xs font-medium text-fg-2">Progress source</legend>
          <Segmented label="Progress source" value={form.progressSource ?? 'MANUAL'} onChange={(v) => set('progressSource', v)}
            options={[{ value: 'MANUAL', label: 'Manual updates' }, { value: 'ANALYTICS', label: 'Synced metric' }]} />
          {form.progressSource === 'ANALYTICS' && (
            linkable.length === 0 ? (
              <Alert tone="info">No connected account reports metrics yet. Connect and sync an account, or track this goal manually.</Alert>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                <FormField label="Account" required>{(p) => (
                  <Select {...p} required value={form.linkedAccountId ?? ''} onChange={(e) => { set('linkedAccountId', e.target.value || null); set('linkedMetricKey', null); }}>
                    <option value="">Choose…</option>
                    {linkable.map((a) => <option key={a.id} value={a.id}>{`${PROVIDER_LABEL[a.provider]} · ${accountName(a)}`}</option>)}
                  </Select>
                )}</FormField>
                <FormField label="Metric" required error={fe('linkedMetricKey')}>{(p) => (
                  <Select {...p} required disabled={!account} value={form.linkedMetricKey ?? ''} onChange={(e) => set('linkedMetricKey', e.target.value || null)}>
                    <option value="">Choose…</option>
                    {metrics.map((m) => <option key={m.metricKey} value={m.metricKey}>{m.label}{m.measureType === 'FLOW' ? ' (summed from start date)' : ''}</option>)}
                  </Select>
                )}</FormField>
              </div>
            )
          )}
          {form.progressSource === 'ANALYTICS' && <p className="text-2xs text-fg-3">Progress updates after each sync and is labelled with its source. Averages can't be goal targets.</p>}
        </fieldset>

        <div className="grid grid-cols-2 gap-3">
          <FormField label="Starting value">{(p) => <Input {...p} type="number" step="any" value={form.startValue ?? 0} onChange={(e) => set('startValue', Number(e.target.value))} />}</FormField>
          <FormField label="Target" required error={fe('targetValue')}>{(p) => <Input {...p} type="number" step="any" required value={form.targetValue} onChange={(e) => set('targetValue', Number(e.target.value))} />}</FormField>
          <FormField label="Start date" required>{(p) => <Input {...p} type="date" required value={form.startDate} onChange={(e) => set('startDate', e.target.value)} />}</FormField>
          <FormField label="Deadline" hint="Optional">{(p) => <Input {...p} type="date" min={form.startDate} value={form.deadline ?? ''} onChange={(e) => set('deadline', e.target.value || null)} />}</FormField>
        </div>
      </form>
    </Drawer>
  );
}
