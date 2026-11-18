import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Ban, Link2, Lock, Users } from 'lucide-react';
import { Link } from 'react-router-dom';
import { BarList } from '@/components/charts/BarList';
import { ChartPanel } from '@/components/charts/ChartPanel';
import { TrendChart } from '@/components/charts/TrendChart';
import { accountName } from '@/components/data/AccountAvatar';
import { DemoNotice } from '@/components/data/DemoNotice';
import { buttonVariants } from '@/components/ui/Button';
import { DateRangePicker } from '@/components/ui/DateRangePicker';
import { EmptyState, ErrorState, PanelSkeleton } from '@/components/ui/Feedback';
import { Select } from '@/components/ui/FormControls';
import { useDateRange } from '@/hooks/useDateRange';
import { useUrlState } from '@/hooks/useUrlState';
import { PageHeader } from '@/layouts/PageHeader';
import { accountsApi, audienceApi } from '@/services/bloomApi';
import type { AudienceDimension, Provider } from '@/types/api';
import { formatDay, formatInstant } from '@/utils/dates';
import { formatMetric } from '@/utils/format';
import { PROVIDER_LABEL } from '@/utils/labels';
import { qk } from '@/utils/queryKeys';

export default function AudiencePage() {
  const accounts = useQuery({ queryKey: qk.accounts, queryFn: accountsApi.list });
  const usable = (accounts.data ?? []).filter((a) => a.connectionStatus !== 'DISCONNECTED' || a.lastSuccessfulSyncAt);
  const [accountId, setAccountId] = useUrlState('account', '');
  const { preset, range, setPreset, setCustom } = useDateRange('90d');
  const selected = usable.find((a) => a.id === accountId) ?? usable[0];
  const params = { accountId: selected?.id ?? '', ...range };
  const audience = useQuery({ queryKey: qk.audience(params), queryFn: () => audienceApi.get(params), enabled: Boolean(selected), placeholderData: keepPreviousData });

  return (
    <>
      <PageHeader title="Audience" description="Follower growth and demographics — only what each platform's API exposes for the scopes you granted."
        actions={usable.length > 0 && (
          <Select aria-label="Account" value={selected?.id ?? ''} onChange={(e) => setAccountId(e.target.value)} className="w-60">
            {usable.map((a) => <option key={a.id} value={a.id}>{`${PROVIDER_LABEL[a.provider]} · ${accountName(a)}`}</option>)}
          </Select>
        )}>
        <DateRangePicker preset={preset} range={range} onPreset={setPreset} onCustom={setCustom} />
      </PageHeader>
      <div className="space-y-4">
        <DemoNotice />
        {accounts.isLoading ? <PanelSkeleton rows={6} /> : accounts.error ? <div className="panel"><ErrorState error={accounts.error} onRetry={() => accounts.refetch()} /></div>
          : !selected ? (
            <div className="panel"><EmptyState icon={Link2} title="Connect an account to see your audience" action={<Link to="/settings/connected-accounts" className={buttonVariants({ variant: 'primary' })}>Connect an account</Link>} /></div>
          ) : audience.isLoading ? <PanelSkeleton rows={6} /> : audience.error ? <div className="panel"><ErrorState error={audience.error} onRetry={() => audience.refetch()} /></div>
            : audience.data && (
              <>
                <ChartPanel title={audience.data.growth.label} description={`${PROVIDER_LABEL[selected.provider]} · ${accountName(selected)} · daily snapshots`}
                  lastSyncedAt={selected.lastSuccessfulSyncAt}
                  meta={audience.data.growth.firstDataDate ? <span>History from {formatDay(audience.data.growth.firstDataDate, 'd MMM yyyy')} (first synced snapshot)</span> : undefined}
                  table={<GrowthTable points={audience.data.growth.points} />}>
                  {audience.data.growth.points.some((p) => p.value !== null)
                    ? <TrendChart unit="COUNT" series={[{ key: 'g', label: audience.data.growth.label, points: audience.data.growth.points }]} />
                    : <p className="py-10 text-center text-sm text-fg-2">No growth snapshots in this range.</p>}
                </ChartPanel>
                <div className="grid gap-3 md:grid-cols-2">
                  {audience.data.dimensions.map((d) => <DimensionCard key={d.dimension} dimension={d} provider={selected.provider} />)}
                </div>
              </>
            )}
      </div>
    </>
  );
}

function GrowthTable({ points }: { points: { date: string; value: number | null }[] }) {
  return (
    <table className="w-full text-xs"><caption className="sr-only">Growth by day</caption>
      <thead><tr className="text-left text-fg-3"><th className="py-1">Date</th><th className="py-1 text-right">Value</th></tr></thead>
      <tbody>{points.map((p) => <tr key={p.date} className="border-t border-border"><td className="py-1">{formatDay(p.date, 'EEE d MMM')}</td><td className="tabular py-1 text-right">{formatMetric(p.value, 'COUNT', false)}</td></tr>)}</tbody>
    </table>
  );
}

function DimensionCard({ dimension: d, provider }: { dimension: AudienceDimension; provider: Provider }) {
  const unavailable = d.availability !== 'AVAILABLE';
  const Icon = d.availability === 'PERMISSION_MISSING' ? Lock : d.availability === 'NOT_SUPPORTED' ? Ban : Users;
  return (
    <section className="panel p-4" aria-label={d.label}>
      <h3 className="text-sm font-semibold">{d.label}</h3>
      {unavailable ? (
        <div className="mt-3 flex items-start gap-2 text-sm text-fg-2">
          <Icon className="mt-0.5 h-4 w-4 shrink-0 text-fg-3" aria-hidden />
          <div>
            <p>{d.reason}</p>
            {d.availability === 'PERMISSION_MISSING' && <Link to="/settings/connected-accounts" className="mt-1 inline-block text-xs font-medium text-accent hover:underline">Reconnect with insights access</Link>}
            {d.apiField && d.availability !== 'NOT_SUPPORTED' && <p className="mt-1 text-2xs text-fg-3">API field: {d.apiField}</p>}
          </div>
        </div>
      ) : (
        <>
          <div className="mt-3"><BarList items={d.buckets} unit={d.unit} /></div>
          <p className="mt-3 text-2xs text-fg-3">
            {PROVIDER_LABEL[provider]} {d.apiField} · {d.window === 'PERIOD_28D' ? '28-day period' : d.window === 'LIFETIME' ? 'current followers' : 'daily'} ending {formatDay(d.asOf, 'd MMM yyyy')} · fetched {formatInstant(d.fetchedAt, 'd MMM, HH:mm')}
            {d.unit === 'PERCENT' && ' · shares of logged-in viewers'}{d.demo && ' · synthetic demo data'}
          </p>
        </>
      )}
    </section>
  );
}
