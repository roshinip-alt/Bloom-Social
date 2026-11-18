import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowRight, Building2, HandCoins, MoreHorizontal, Pencil, Plus, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { BarChartView } from '@/components/charts/BarChartView';
import { ChartPanel } from '@/components/charts/ChartPanel';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { ConfirmDialog } from '@/components/ui/Dialog';
import { Alert, EmptyState, ErrorState, PanelSkeleton, errorMessage } from '@/components/ui/Feedback';
import { Checkbox, Input, Select } from '@/components/ui/FormControls';
import { IconButton } from '@/components/ui/IconButton';
import { Menu } from '@/components/ui/Menu';
import { Tabs, TabsContent, TabsList } from '@/components/ui/Tabs';
import { useToast } from '@/hooks/useToast';
import { useUrlState } from '@/hooks/useUrlState';
import { PageHeader } from '@/layouts/PageHeader';
import { brandApi } from '@/services/bloomApi';
import type { Brand, Campaign, CampaignStage, CurrencySummary } from '@/types/api';
import { formatDay } from '@/utils/dates';
import { formatCurrency } from '@/utils/format';
import { CAMPAIGN_STAGES, CAMPAIGN_STAGE_LABEL } from '@/utils/labels';
import { qk } from '@/utils/queryKeys';
import { BrandDialog } from './BrandDialog';
import { CampaignDrawer } from './CampaignDrawer';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export default function BrandEarningsPage() {
  const [params, setParams] = useSearchParams();
  const [tab, setTab] = useUrlState('tab', 'pipeline');
  const [campaignId, setCampaignId] = useUrlState('campaign', '');
  const [creating, setCreating] = useState<{ open: boolean; stage?: CampaignStage }>({ open: false });

  useEffect(() => {
    if (params.get('new') === 'campaign') {
      setCreating({ open: true });
      setParams((p) => { const n = new URLSearchParams(p); n.delete('new'); return n; }, { replace: true });
    }
  }, [params, setParams]);

  return (
    <>
      <PageHeader title="Brand & Earnings" description="Collaborations, deliverables and earnings — tracked by you. Bloom processes no payments."
        actions={<Button variant="primary" onClick={() => setCreating({ open: true })}><Plus /> New campaign</Button>}>
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList items={[{ value: 'pipeline', label: 'Pipeline' }, { value: 'brands', label: 'Brands' }, { value: 'earnings', label: 'Earnings' }]} />
        </Tabs>
      </PageHeader>
      <Tabs value={tab} onValueChange={setTab}>
        <TabsContent value="pipeline"><Pipeline onOpen={setCampaignId} onCreate={(stage) => setCreating({ open: true, stage })} /></TabsContent>
        <TabsContent value="brands"><Brands /></TabsContent>
        <TabsContent value="earnings"><Earnings /></TabsContent>
      </Tabs>
      <CampaignDrawer campaignId={campaignId || null} creating={creating.open} defaultStage={creating.stage}
        onClose={() => { setCreating({ open: false }); setCampaignId(null); }}
        onCreated={(c) => { setCreating({ open: false }); setCampaignId(c.id); }} />
    </>
  );
}

function Pipeline({ onOpen, onCreate }: { onOpen: (id: string) => void; onCreate: (stage: CampaignStage) => void }) {
  const client = useQueryClient();
  const toast = useToast();
  const [showArchived, setShowArchived] = useState(false);
  const campaigns = useQuery({ queryKey: qk.campaigns, queryFn: () => brandApi.campaigns() });
  const move = useMutation({
    mutationFn: ({ id, stage }: { id: string; stage: CampaignStage }) => brandApi.moveStage(id, stage),
    onSuccess: async (c) => { await client.invalidateQueries({ queryKey: ['brand'] }); toast.success(`${c.name} → ${CAMPAIGN_STAGE_LABEL[c.stage]}`); },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const stages = CAMPAIGN_STAGES.filter((s) => showArchived || s !== 'ARCHIVED');
  if (campaigns.isLoading) return <PanelSkeleton rows={6} />;
  if (campaigns.error) return <div className="panel"><ErrorState error={campaigns.error} onRetry={() => campaigns.refetch()} /></div>;
  return (
    <div className="space-y-2">
      <Checkbox label="Show archived" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} />
      <div className="relative -mx-4 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0">
        <div className="flex gap-3" style={{ minWidth: stages.length * 216 }}>
          {stages.map((stage) => {
            const items = (campaigns.data ?? []).filter((c) => c.stage === stage);
            return (
              <section key={stage} aria-label={CAMPAIGN_STAGE_LABEL[stage]} className="flex w-52 shrink-0 flex-col rounded-lg border border-border bg-surface-2/50">
                <header className="flex items-center justify-between px-3 py-2">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-fg-2">{CAMPAIGN_STAGE_LABEL[stage]}</h3>
                  <span className="flex items-center gap-1">
                    <span className="tabular text-2xs text-fg-3">{items.length}</span>
                    <IconButton size="sm" label={`New campaign in ${CAMPAIGN_STAGE_LABEL[stage]}`} icon={<Plus />} onClick={() => onCreate(stage)} />
                  </span>
                </header>
                <div className="flex min-h-[240px] flex-col gap-2 px-2 pb-2">
                  {items.map((c) => <CampaignCard key={c.id} campaign={c} onOpen={() => onOpen(c.id)} onMove={(s) => move.mutate({ id: c.id, stage: s })} />)}
                </div>
              </section>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function CampaignCard({ campaign: c, onOpen, onMove }: { campaign: Campaign; onOpen: () => void; onMove: (s: CampaignStage) => void }) {
  const idx = CAMPAIGN_STAGES.indexOf(c.stage);
  const next = idx < CAMPAIGN_STAGES.length - 2 ? CAMPAIGN_STAGES[idx + 1] : null;
  const overdue = c.deliverables.some((d) => d.overdue) || c.payments.some((p) => p.overdue);
  return (
    <article className="rounded-md border border-border bg-surface p-2.5">
      <div className="flex items-start gap-1">
        <button type="button" onClick={onOpen} className="min-w-0 flex-1 text-left">
          <p className="truncate text-2xs text-fg-3">{c.brandName}</p>
          <p className="text-sm font-medium hover:underline">{c.name}</p>
        </button>
        <Menu label={`Move ${c.name}`} trigger={<IconButton size="sm" label="Campaign actions" icon={<MoreHorizontal />} tooltip={false} />} items={[
          { label: 'Open', icon: <Pencil />, onSelect: onOpen },
          ...CAMPAIGN_STAGES.filter((s) => s !== c.stage).map((s) => ({ label: `Move to ${CAMPAIGN_STAGE_LABEL[s]}`, icon: <ArrowRight />, onSelect: () => onMove(s) })),
        ]} />
      </div>
      <p className="tabular mt-1 text-xs">{c.agreedAmount === null ? <span className="text-fg-3">No amount yet</span> : formatCurrency(c.agreedAmount, c.currency)}</p>
      <div className="mt-1 flex flex-wrap gap-1">
        {overdue && <Badge tone="danger">Overdue item</Badge>}
        {c.nextDeadline && !overdue && <Badge tone="outline">Next {formatDay(c.nextDeadline)}</Badge>}
        {c.deliverables.length > 0 && <Badge>{c.deliverables.filter((d) => ['APPROVED', 'PUBLISHED'].includes(d.status)).length}/{c.deliverables.length} delivered</Badge>}
      </div>
      {next && <Button size="sm" variant="ghost" className="mt-1 w-full justify-between" onClick={() => onMove(next)}>Move to {CAMPAIGN_STAGE_LABEL[next]} <ArrowRight /></Button>}
    </article>
  );
}

function Brands() {
  const client = useQueryClient();
  const toast = useToast();
  const [query, setQuery] = useState('');
  const [dialog, setDialog] = useState<{ open: boolean; brand: Brand | null }>({ open: false, brand: null });
  const [deleting, setDeleting] = useState<Brand | null>(null);
  const brands = useQuery({ queryKey: qk.brands(query), queryFn: () => brandApi.brands(query || undefined) });
  const remove = useMutation({
    mutationFn: (id: string) => brandApi.deleteBrand(id),
    onSuccess: async () => { setDeleting(null); await client.invalidateQueries({ queryKey: ['brand'] }); toast.success('Brand deleted'); },
  });
  const columns: Column<Brand>[] = [
    { key: 'name', header: 'Brand', cell: (b) => <span className="font-medium">{b.brandName}</span> },
    { key: 'contact', header: 'Contact', cell: (b) => <span className="text-xs">{b.contactName ?? '—'}</span> },
    { key: 'email', header: 'Email', cell: (b) => (b.email ? <a href={`mailto:${b.email}`} className="text-xs text-accent hover:underline" onClick={(e) => e.stopPropagation()}>{b.email}</a> : <span className="text-xs text-fg-3">—</span>) },
    { key: 'campaigns', header: 'Campaigns', align: 'right', cell: (b) => b.campaignCount },
    { key: 'actions', header: <span className="sr-only">Actions</span>, align: 'right', cell: (b) => (
      <span onClick={(e) => e.stopPropagation()}>
        <Menu label={`Actions for ${b.brandName}`} trigger={<IconButton size="sm" label="Brand actions" icon={<MoreHorizontal />} tooltip={false} />} items={[
          { label: 'Edit', icon: <Pencil />, onSelect: () => setDialog({ open: true, brand: b }) },
          { label: 'Delete', icon: <Trash2 />, destructive: true, onSelect: () => { remove.reset(); setDeleting(b); } },
        ]} />
      </span>
    ) },
  ];
  return (
    <section className="panel">
      <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-2.5">
        <Input type="search" aria-label="Search brands" placeholder="Search brands or contacts…" value={query} onChange={(e) => setQuery(e.target.value)} className="max-w-xs" />
        <Button className="ml-auto" onClick={() => setDialog({ open: true, brand: null })}><Plus /> New brand</Button>
      </div>
      {brands.isLoading ? <PanelSkeleton rows={4} className="border-0 shadow-none" /> : brands.error ? <ErrorState error={brands.error} onRetry={() => brands.refetch()} /> : (
        <DataTable caption="Brands" columns={columns} rows={brands.data ?? []} rowKey={(b) => b.id} onRowClick={(b) => setDialog({ open: true, brand: b })}
          empty={<EmptyState icon={Building2} title={query ? 'No matching brands' : 'No brands yet'} description="Keep each brand's contact details next to your campaigns." action={!query ? <Button onClick={() => setDialog({ open: true, brand: null })}><Plus /> Add brand</Button> : undefined} />} />
      )}
      <BrandDialog open={dialog.open} brand={dialog.brand} onOpenChange={(open) => setDialog((d) => ({ ...d, open }))} />
      <ConfirmDialog open={Boolean(deleting)} onOpenChange={(o) => !o && setDeleting(null)} title={`Delete ${deleting?.brandName}?`}
        description="The brand and its contact details are removed." confirmLabel="Delete brand" loading={remove.isPending} onConfirm={() => deleting && remove.mutate(deleting.id)}>
        {remove.error ? <Alert tone="danger">{errorMessage(remove.error)}</Alert> : null}
      </ConfirmDialog>
    </section>
  );
}

function Earnings() {
  const thisYear = new Date().getFullYear();
  const [year, setYear] = useUrlState('year', String(thisYear));
  const earnings = useQuery({ queryKey: qk.earnings(Number(year)), queryFn: () => brandApi.earnings(Number(year)) });
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Select aria-label="Year" value={year} onChange={(e) => setYear(e.target.value)} className="w-28">
          {[thisYear, thisYear - 1, thisYear - 2].map((y) => <option key={y} value={y}>{y}</option>)}
        </Select>
        <p className="text-xs text-fg-2">Each currency is reported separately — amounts are never converted or added across currencies.</p>
      </div>
      {earnings.isLoading ? <PanelSkeleton rows={4} /> : earnings.error ? <div className="panel"><ErrorState error={earnings.error} onRetry={() => earnings.refetch()} /></div> : (
        <>
          {earnings.data!.overduePayments > 0 && <Alert tone="warning" title={`${earnings.data!.overduePayments} overdue payment${earnings.data!.overduePayments > 1 ? 's' : ''}`}>Open the campaign to follow up or mark it paid.</Alert>}
          {earnings.data!.currencies.length === 0 ? (
            <div className="panel"><EmptyState icon={HandCoins} title="No earnings recorded" description="Add a campaign with an agreed amount, then record invoices and payments as they happen." /></div>
          ) : earnings.data!.currencies.map((c) => <CurrencySection key={c.currency} summary={c} year={Number(year)} />)}
        </>
      )}
    </div>
  );
}

function CurrencySection({ summary: s, year }: { summary: CurrencySummary; year: number }) {
  const fmt = (v: number) => formatCurrency(v, s.currency);
  const tiles = [
    ['Paid in ' + year, s.paidInYear, 'Payments with a paid date in this year.'],
    ['Invoiced, unpaid', s.invoicedUnpaid, 'Recorded invoices without a paid date.'],
    ['Overdue', s.overdue, 'Unpaid invoices past their due date.'],
    ['Committed, unpaid', s.committedUnpaid, 'Agreed minus paid for Confirmed, In progress and Delivered campaigns.'],
    ['Pipeline (not committed)', s.pipelineValue, 'Quoted amounts for Lead, Contacted and Negotiating campaigns.'],
  ] as const;
  return (
    <section aria-label={`${s.currency} earnings`} className="space-y-3">
      <h3 className="text-sm font-semibold">{s.currency}</h3>
      <dl className="grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {tiles.map(([label, value, help]) => (
          <div key={label} className="panel p-3" title={help}>
            <dt className="text-xs text-fg-2">{label}</dt>
            <dd className="tabular mt-1 text-lg font-semibold">{fmt(value)}</dd>
          </div>
        ))}
      </dl>
      <ChartPanel title={`Paid per month · ${s.currency}`} description={`${year}, by paid date`}
        table={
          <table className="w-full text-xs"><caption className="sr-only">Paid per month in {s.currency}</caption>
            <tbody>{s.monthly.map((m) => <tr key={m.month} className="border-t border-border"><td className="py-1">{MONTHS[m.month - 1]}</td><td className="tabular py-1 text-right">{fmt(m.paid)}</td></tr>)}</tbody>
          </table>
        }>
        <BarChartView label={`Paid per month in ${s.currency}`} format={fmt} data={s.monthly.map((m) => ({ label: MONTHS[m.month - 1]!, value: m.paid }))} />
      </ChartPanel>
    </section>
  );
}
