import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, Plus, Trash2 } from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog, Drawer } from '@/components/ui/Dialog';
import { Alert, ErrorState, PanelSkeleton, errorMessage } from '@/components/ui/Feedback';
import { FormField, Input, Select, Textarea } from '@/components/ui/FormControls';
import { IconButton } from '@/components/ui/IconButton';
import { useToast } from '@/hooks/useToast';
import { useWorkspace } from '@/hooks/useWorkspace';
import { ApiError } from '@/services/apiClient';
import { brandApi } from '@/services/bloomApi';
import type { Campaign, CampaignInput, CampaignStage, DeliverableStatus, Provider } from '@/types/api';
import { PROVIDERS } from '@/types/api';
import { formatDay, todayLocal } from '@/utils/dates';
import { formatCurrency } from '@/utils/format';
import { CAMPAIGN_STAGES, CAMPAIGN_STAGE_LABEL, DELIVERABLE_STATUS_LABEL, PROVIDER_LABEL } from '@/utils/labels';
import { qk } from '@/utils/queryKeys';

function useInvalidateBrand() {
  const client = useQueryClient();
  return async () => {
    await client.invalidateQueries({ queryKey: ['brand'] });
    void client.invalidateQueries({ queryKey: ['content'] });
  };
}

export function CampaignDrawer({ campaignId, creating, onClose, onCreated, defaultStage }: { campaignId: string | null; creating: boolean; onClose: () => void; onCreated: (c: Campaign) => void; defaultStage?: CampaignStage }) {
  const campaign = useQuery({ queryKey: qk.campaign(campaignId ?? ''), queryFn: () => brandApi.campaign(campaignId!), enabled: Boolean(campaignId) });
  const c = campaign.data;
  return (
    <Drawer open={creating || Boolean(campaignId)} onOpenChange={(o) => !o && onClose()} width="lg" title={creating ? 'New campaign' : c ? c.name : 'Campaign'}
      description={c ? `${c.brandName} · ${CAMPAIGN_STAGE_LABEL[c.stage]}` : 'Manual tracking only — Bloom processes no payments.'}>
      {creating ? <CampaignForm campaign={null} onSaved={onCreated} defaultStage={defaultStage} onDeleted={onClose} />
        : campaign.isLoading ? <PanelSkeleton /> : campaign.error || !c ? <ErrorState error={campaign.error} onRetry={() => campaign.refetch()} /> : (
          <div className="space-y-6">
            <Totals campaign={c} />
            <CampaignForm campaign={c} onSaved={() => undefined} onDeleted={onClose} />
            <Deliverables campaign={c} />
            <Payments campaign={c} />
          </div>
        )}
    </Drawer>
  );
}

function Totals({ campaign: c }: { campaign: Campaign }) {
  return (
    <dl className="grid grid-cols-3 gap-2">
      {[
        ['Agreed', c.agreedAmount === null ? 'Not set' : formatCurrency(c.agreedAmount, c.currency)],
        ['Paid', formatCurrency(c.paidAmount, c.currency)],
        ['Outstanding', c.outstandingAmount === null ? '—' : formatCurrency(c.outstandingAmount, c.currency)],
      ].map(([k, v]) => (
        <div key={k} className="rounded-md border border-border px-3 py-2">
          <dt className="label">{k}</dt>
          <dd className="tabular mt-0.5 text-sm font-semibold">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

function CampaignForm({ campaign, onSaved, defaultStage, onDeleted }: { campaign: Campaign | null; onSaved: (c: Campaign) => void; defaultStage?: CampaignStage; onDeleted: () => void }) {
  const toast = useToast();
  const invalidate = useInvalidateBrand();
  const { current } = useWorkspace();
  const brands = useQuery({ queryKey: qk.brands(), queryFn: () => brandApi.brands() });
  const [form, setForm] = useState<CampaignInput>({ brandContactId: '', name: '', currency: current?.defaultCurrency ?? 'USD' });
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    setForm(campaign ? {
      brandContactId: campaign.brandContactId, name: campaign.name, stage: campaign.stage, agreedAmount: campaign.agreedAmount,
      currency: campaign.currency, startDate: campaign.startDate, endDate: campaign.endDate, notes: campaign.notes,
    } : { brandContactId: brands.data?.[0]?.id ?? '', name: '', stage: defaultStage ?? 'LEAD', currency: current?.defaultCurrency ?? 'USD' });
  }, [campaign, brands.data, current, defaultStage]);

  const save = useMutation({
    mutationFn: () => {
      const body = { ...form, agreedAmount: form.agreedAmount === undefined || Number.isNaN(form.agreedAmount) ? null : form.agreedAmount, notes: form.notes || null, startDate: form.startDate || null, endDate: form.endDate || null };
      return campaign ? brandApi.updateCampaign(campaign.id, body) : brandApi.createCampaign(body);
    },
    onSuccess: async (c) => { await invalidate(); toast.success(campaign ? 'Campaign saved' : 'Campaign created'); onSaved(c); },
  });
  const remove = useMutation({
    mutationFn: () => brandApi.deleteCampaign(campaign!.id),
    onSuccess: async () => { setConfirmDelete(false); await invalidate(); toast.success('Campaign deleted'); onDeleted(); },
  });
  const set = <K extends keyof CampaignInput>(k: K, v: CampaignInput[K]) => setForm((f) => ({ ...f, [k]: v }));
  const fe = (f: string) => (save.error instanceof ApiError ? save.error.fieldError(f) : undefined);
  const submit = (e: FormEvent) => { e.preventDefault(); save.mutate(); };

  if (brands.data && brands.data.length === 0) {
    return <Alert tone="info" title="Add a brand first">Campaigns belong to a brand. Add one from the Brands tab.</Alert>;
  }
  return (
    <form onSubmit={submit} className="space-y-3">
      <h3 className="label">Details</h3>
      {save.error && !(save.error instanceof ApiError && save.error.fieldErrors.length) ? <Alert tone="danger">{errorMessage(save.error)}</Alert> : null}
      <div className="grid gap-3 sm:grid-cols-2">
        <FormField label="Brand" required>{(p) => (
          <Select {...p} required value={form.brandContactId} onChange={(e) => set('brandContactId', e.target.value)}>
            {(brands.data ?? []).map((b) => <option key={b.id} value={b.id}>{b.brandName}</option>)}
          </Select>
        )}</FormField>
        <FormField label="Campaign name" required error={fe('name')}>{(p) => <Input {...p} required maxLength={200} value={form.name} onChange={(e) => set('name', e.target.value)} />}</FormField>
        <FormField label="Stage">{(p) => (
          <Select {...p} value={form.stage} onChange={(e) => set('stage', e.target.value as CampaignStage)}>
            {CAMPAIGN_STAGES.map((s) => <option key={s} value={s}>{CAMPAIGN_STAGE_LABEL[s]}</option>)}
          </Select>
        )}</FormField>
        <div className="grid grid-cols-[1fr_88px] gap-2">
          <FormField label="Agreed amount" error={fe('agreedAmount')}>{(p) => <Input {...p} type="number" min={0} step="0.01" value={form.agreedAmount ?? ''} onChange={(e) => set('agreedAmount', e.target.value === '' ? null : Number(e.target.value))} />}</FormField>
          <FormField label="Currency" error={fe('currency') ?? (save.error instanceof ApiError && save.error.code === 'CURRENCY_LOCKED' ? 'Locked' : undefined)}>
            {(p) => <Input {...p} required maxLength={3} pattern="[A-Za-z]{3}" value={form.currency} onChange={(e) => set('currency', e.target.value.toUpperCase())} />}
          </FormField>
        </div>
        <FormField label="Start date">{(p) => <Input {...p} type="date" value={form.startDate ?? ''} onChange={(e) => set('startDate', e.target.value || null)} />}</FormField>
        <FormField label="End date">{(p) => <Input {...p} type="date" min={form.startDate ?? undefined} value={form.endDate ?? ''} onChange={(e) => set('endDate', e.target.value || null)} />}</FormField>
      </div>
      <FormField label="Notes">{(p) => <Textarea {...p} rows={2} value={form.notes ?? ''} onChange={(e) => set('notes', e.target.value)} />}</FormField>
      <div className="flex justify-end gap-2">
        {campaign && <Button variant="destructive-ghost" className="mr-auto" onClick={() => setConfirmDelete(true)}><Trash2 /> Delete</Button>}
        <Button variant="primary" type="submit" loading={save.isPending}>{campaign ? 'Save details' : 'Create campaign'}</Button>
      </div>
      <ConfirmDialog open={confirmDelete} onOpenChange={setConfirmDelete} title="Delete this campaign?" description="Its deliverables and payment records are deleted. Consider archiving instead to keep earnings history."
        confirmLabel="Delete campaign" loading={remove.isPending} onConfirm={() => remove.mutate()} />
    </form>
  );
}

function Deliverables({ campaign }: { campaign: Campaign }) {
  const invalidate = useInvalidateBrand();
  const toast = useToast();
  const [title, setTitle] = useState('');
  const [platform, setPlatform] = useState<Provider | ''>('');
  const [due, setDue] = useState('');
  const mutate = useMutation({
    mutationFn: async (a: { type: 'add' } | { type: 'status'; id: string; title: string; status: DeliverableStatus } | { type: 'delete'; id: string }) => {
      if (a.type === 'add') return brandApi.addDeliverable(campaign.id, { title, platform: platform || null, dueDate: due || null });
      if (a.type === 'status') {
        const d = campaign.deliverables.find((x) => x.id === a.id)!;
        return brandApi.updateDeliverable(campaign.id, a.id, { title: d.title, platform: d.platform, dueDate: d.dueDate, status: a.status, contentDraftId: d.contentDraftId, notes: d.notes });
      }
      return brandApi.deleteDeliverable(campaign.id, a.id);
    },
    onSuccess: async (_r, a) => { if (a.type === 'add') { setTitle(''); setDue(''); } await invalidate(); },
    onError: (e) => toast.error(errorMessage(e)),
  });
  return (
    <section className="space-y-2">
      <h3 className="label">Deliverables</h3>
      <ul className="divide-y divide-border rounded-md border border-border">
        {campaign.deliverables.length === 0 && <li className="px-3 py-3 text-sm text-fg-2">No deliverables yet.</li>}
        {campaign.deliverables.map((d) => (
          <li key={d.id} className="flex flex-wrap items-center gap-2 px-3 py-2 text-sm">
            <span className="min-w-0 flex-1 truncate">{d.title}</span>
            {d.platform && <span className="text-2xs text-fg-3">{PROVIDER_LABEL[d.platform]}</span>}
            {d.dueDate && <span className={d.overdue ? 'text-2xs font-medium text-danger' : 'text-2xs text-fg-3'}>{d.overdue ? 'Overdue · ' : ''}{formatDay(d.dueDate)}</span>}
            <Select aria-label={`Status of ${d.title}`} value={d.status} onChange={(e) => mutate.mutate({ type: 'status', id: d.id, title: d.title, status: e.target.value as DeliverableStatus })} className="h-7 w-32 text-xs">
              {Object.entries(DELIVERABLE_STATUS_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </Select>
            <IconButton size="sm" label={`Delete ${d.title}`} icon={<Trash2 />} onClick={() => mutate.mutate({ type: 'delete', id: d.id })} />
          </li>
        ))}
      </ul>
      <form className="flex flex-wrap gap-2" onSubmit={(e) => { e.preventDefault(); if (title.trim()) mutate.mutate({ type: 'add' }); }}>
        <Input aria-label="Deliverable" placeholder="e.g. 60s integration" value={title} maxLength={200} onChange={(e) => setTitle(e.target.value)} className="min-w-[160px] flex-1" />
        <Select aria-label="Platform" value={platform} onChange={(e) => setPlatform(e.target.value as Provider | '')} className="w-32">
          <option value="">Platform</option>
          {PROVIDERS.map((p) => <option key={p} value={p}>{PROVIDER_LABEL[p]}</option>)}
        </Select>
        <Input aria-label="Due date" type="date" value={due} onChange={(e) => setDue(e.target.value)} className="w-36" />
        <Button type="submit" disabled={!title.trim()}><Plus /> Add</Button>
      </form>
    </section>
  );
}

function Payments({ campaign }: { campaign: Campaign }) {
  const invalidate = useInvalidateBrand();
  const toast = useToast();
  const [amount, setAmount] = useState('');
  const [ref, setRef] = useState('');
  const [invoiced, setInvoiced] = useState('');
  const [due, setDue] = useState('');
  const [paid, setPaid] = useState('');
  const add = useMutation({
    mutationFn: () => brandApi.addPayment(campaign.id, { amount: Number(amount), currency: campaign.currency, invoiceReference: ref || null, invoicedDate: invoiced || null, dueDate: due || null, paidDate: paid || null }),
    onSuccess: async () => { setAmount(''); setRef(''); setInvoiced(''); setDue(''); setPaid(''); await invalidate(); toast.success('Payment recorded'); },
  });
  const update = useMutation({
    mutationFn: async (a: { type: 'paid'; id: string } | { type: 'delete'; id: string }) => {
      if (a.type === 'delete') return brandApi.deletePayment(campaign.id, a.id);
      const p = campaign.payments.find((x) => x.id === a.id)!;
      return brandApi.updatePayment(campaign.id, a.id, { amount: p.amount, currency: p.currency, invoiceReference: p.invoiceReference, invoicedDate: p.invoicedDate, dueDate: p.dueDate, paidDate: todayLocal(), note: p.note });
    },
    onSuccess: invalidate,
    onError: (e) => toast.error(errorMessage(e)),
  });
  return (
    <section className="space-y-2">
      <h3 className="label">Invoices & payments ({campaign.currency})</h3>
      <ul className="divide-y divide-border rounded-md border border-border">
        {campaign.payments.length === 0 && <li className="px-3 py-3 text-sm text-fg-2">No invoices or payments recorded.</li>}
        {campaign.payments.map((p) => (
          <li key={p.id} className="flex flex-wrap items-center gap-2 px-3 py-2 text-sm">
            <span className="tabular w-28 font-medium">{formatCurrency(p.amount, p.currency)}</span>
            <span className="flex-1 truncate text-xs text-fg-2">{p.invoiceReference ?? 'No reference'}{p.dueDate ? ` · due ${formatDay(p.dueDate)}` : ''}</span>
            {p.paid ? <Badge tone="accent" icon={<CheckCircle2 />}>Paid {formatDay(p.paidDate)}</Badge>
              : p.overdue ? <Badge tone="danger">Overdue</Badge> : <Badge tone="warning">Unpaid</Badge>}
            {!p.paid && <Button size="sm" onClick={() => update.mutate({ type: 'paid', id: p.id })}>Mark paid today</Button>}
            <IconButton size="sm" label="Delete payment record" icon={<Trash2 />} onClick={() => update.mutate({ type: 'delete', id: p.id })} />
          </li>
        ))}
      </ul>
      <form className="grid gap-2 sm:grid-cols-3" onSubmit={(e) => { e.preventDefault(); add.mutate(); }}>
        {add.error ? <Alert tone="danger" className="sm:col-span-3">{errorMessage(add.error)}</Alert> : null}
        <FormField label={`Amount (${campaign.currency})`} required>{(p) => <Input {...p} type="number" min={0} step="0.01" required value={amount} onChange={(e) => setAmount(e.target.value)} />}</FormField>
        <FormField label="Invoice / reference">{(p) => <Input {...p} maxLength={96} value={ref} onChange={(e) => setRef(e.target.value)} />}</FormField>
        <FormField label="Invoiced on">{(p) => <Input {...p} type="date" value={invoiced} onChange={(e) => setInvoiced(e.target.value)} />}</FormField>
        <FormField label="Due date">{(p) => <Input {...p} type="date" value={due} onChange={(e) => setDue(e.target.value)} />}</FormField>
        <FormField label="Paid on" hint="Leave empty if unpaid">{(p) => <Input {...p} type="date" max={todayLocal()} value={paid} onChange={(e) => setPaid(e.target.value)} />}</FormField>
        <div className="flex items-end"><Button type="submit" variant="primary" loading={add.isPending} disabled={amount === ''} className="w-full"><Plus /> Add record</Button></div>
      </form>
    </section>
  );
}
