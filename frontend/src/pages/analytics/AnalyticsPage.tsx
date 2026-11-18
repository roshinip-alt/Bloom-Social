import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { BarChart3, ExternalLink, Info, Link2 } from 'lucide-react';
import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { ChartPanel } from '@/components/charts/ChartPanel';
import { TrendChart } from '@/components/charts/TrendChart';
import { AccountAvatar, accountName } from '@/components/data/AccountAvatar';
import { DemoNotice } from '@/components/data/DemoNotice';
import { PlatformBadge } from '@/components/data/PlatformBadge';
import { Badge } from '@/components/ui/Badge';
import { buttonVariants } from '@/components/ui/Button';
import { DataTable, Pagination, type Column } from '@/components/ui/DataTable';
import { DateRangePicker } from '@/components/ui/DateRangePicker';
import { EmptyState, ErrorState, PanelSkeleton } from '@/components/ui/Feedback';
import { Select } from '@/components/ui/FormControls';
import { Tabs, TabsContent, TabsList } from '@/components/ui/Tabs';
import { Tooltip } from '@/components/ui/Tooltip';
import { useDateRange } from '@/hooks/useDateRange';
import { useUrlState } from '@/hooks/useUrlState';
import { PageHeader } from '@/layouts/PageHeader';
import { analyticsApi } from '@/services/bloomApi';
import type { AccountSummary, MetricDefinition, MetricValue, Post, Provider, SeriesResponse } from '@/types/api';
import { PROVIDERS } from '@/types/api';
import { cn } from '@/utils/cn';
import { formatDay, formatInstant, relativeTime } from '@/utils/dates';
import { formatChange, formatMetric } from '@/utils/format';
import { availabilityText, CONNECTION_STATUS_LABEL, CONTENT_TYPE_LABEL, PROVIDER_LABEL } from '@/utils/labels';
import { qk } from '@/utils/queryKeys';

export default function AnalyticsPage() {
  const [tab, setTab] = useUrlState('tab', 'overview');
  const [provider, setProvider] = useUrlState('platform', '');
  const { preset, range, setPreset, setCustom } = useDateRange();
  return (
    <>
      <PageHeader title="Analytics" description="Stored snapshots per account. History before the first sync is never estimated."
        actions={
          <Select aria-label="Platform filter" value={provider} onChange={(e) => setProvider(e.target.value)} className="w-40">
            <option value="">All platforms</option>
            {PROVIDERS.map((p) => <option key={p} value={p}>{PROVIDER_LABEL[p]}</option>)}
          </Select>
        }>
        <DateRangePicker preset={preset} range={range} onPreset={setPreset} onCustom={setCustom} />
      </PageHeader>
      <div className="space-y-4">
        <DemoNotice />
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList items={[{ value: 'overview', label: 'Overview' }, { value: 'content', label: 'Content performance' }, { value: 'definitions', label: 'Metric definitions' }]} />
          <TabsContent value="overview" className="pt-4"><Overview range={range} provider={provider} /></TabsContent>
          <TabsContent value="content" className="pt-4"><ContentPerformance range={range} provider={provider as Provider | ''} /></TabsContent>
          <TabsContent value="definitions" className="pt-4"><Definitions provider={provider as Provider | ''} /></TabsContent>
        </Tabs>
      </div>
    </>
  );
}

function Overview({ range, provider }: { range: { from: string; to: string }; provider: string }) {
  const params = { ...range, provider: provider || undefined };
  const summary = useQuery({ queryKey: qk.summary(params), queryFn: () => analyticsApi.summary(params), placeholderData: keepPreviousData });
  if (summary.isLoading) return <PanelSkeleton rows={6} />;
  if (summary.error) return <div className="panel"><ErrorState error={summary.error} onRetry={() => summary.refetch()} /></div>;
  const data = summary.data!;
  if (data.accounts.length === 0) {
    return (
      <div className="panel">
        <EmptyState icon={Link2} title={provider ? `No ${PROVIDER_LABEL[provider as Provider]} account connected` : 'No accounts connected'}
          description="Connect an account to collect snapshots. Bloom stores each sync so history outlives provider look-back limits."
          action={<Link to="/settings/connected-accounts" className={buttonVariants({ variant: 'primary' })}>Connect an account</Link>} />
      </div>
    );
  }
  return (
    <div className="space-y-4">
      <p className="text-xs text-fg-2">Comparing {formatDay(data.from, 'd MMM')} – {formatDay(data.to, 'd MMM yyyy')} with {formatDay(data.previousFrom, 'd MMM')} – {formatDay(data.previousTo, 'd MMM yyyy')}.</p>
      {data.accounts.map((s) => <AccountMetrics key={s.account.id} summary={s} range={range} />)}
    </div>
  );
}

function AccountMetrics({ summary, range }: { summary: AccountSummary; range: { from: string; to: string } }) {
  const { account, metrics } = summary;
  const [metricKey, setMetricKey] = useUrlState(`m-${account.id.slice(0, 8)}`, metrics.find((m) => m.value !== null)?.metricKey ?? metrics[0]?.metricKey ?? '');
  const selected = metrics.find((m) => m.metricKey === metricKey);
  const seriesParams = { accountId: account.id, metricKey, ...range };
  const series = useQuery({ queryKey: qk.series(seriesParams), queryFn: () => analyticsApi.series(seriesParams), enabled: Boolean(metricKey), placeholderData: keepPreviousData });
  const firstData = metrics.map((m) => m.firstDataDate).filter(Boolean).sort()[0];

  const columns: Column<MetricValue>[] = [
    { key: 'metric', header: 'Metric', cell: (m) => (
      <span className="inline-flex items-center gap-1">
        {m.label}
        <Tooltip content={`${m.description} Source: ${m.apiSource}.`}><button type="button" aria-label={`About ${m.label}`} className="text-fg-3 hover:text-fg"><Info className="h-3.5 w-3.5" /></button></Tooltip>
      </span>
    ) },
    { key: 'value', header: 'Value', align: 'right', cell: (m) => m.value === null ? <span className="text-xs text-fg-3">{availabilityText(m.availability, account.provider)}</span> : <span className="font-medium">{formatMetric(m.value, m.unit, false)}</span> },
    { key: 'change', header: 'vs previous', align: 'right', cell: (m) => {
      const c = formatChange(m.change, m.previousValue, m.unit);
      return c ? <span className={cn(c.direction === 'up' && 'text-accent', c.direction === 'down' && 'text-danger')}>{c.percent ?? c.text}</span> : <span className="text-fg-3">—</span>;
    } },
    { key: 'coverage', header: 'Coverage', align: 'right', cell: (m) => m.measureType === 'FLOW'
      ? <span className={cn('text-xs', m.coveredDays < m.rangeDays && 'text-warning')}>{m.coveredDays}/{m.rangeDays} days</span>
      : <span className="text-xs text-fg-2">{m.lastDataDate ? `as of ${formatDay(m.lastDataDate)}` : '—'}</span> },
  ];

  return (
    <section className="panel" aria-label={`${accountName(account)} metrics`}>
      <header className="flex flex-wrap items-center gap-3 border-b border-border px-4 py-3">
        <AccountAvatar name={accountName(account)} avatarUrl={account.avatarUrl} provider={account.provider} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{accountName(account)} {account.dataMode === 'DEMO' && <Badge tone="accent">Demo</Badge>}</p>
          <p className="text-2xs text-fg-3">
            {PROVIDER_LABEL[account.provider]} · {CONNECTION_STATUS_LABEL[account.connectionStatus]} · last successful sync {relativeTime(account.lastSuccessfulSyncAt)}
            {firstData && ` · history from ${formatDay(firstData, 'd MMM yyyy')}`}
          </p>
        </div>
      </header>
      {account.connectionStatus !== 'ACTIVE' && (
        <p className="border-b border-border bg-warning-soft px-4 py-2 text-xs">Data stops at the last successful sync. <Link className="font-medium underline" to="/settings/connected-accounts">Reconnect the account</Link> to resume.</p>
      )}
      <div className="grid gap-0 lg:grid-cols-[1.1fr_1fr]">
        <DataTable caption={`Metrics for ${accountName(account)}`} columns={columns} rows={metrics} rowKey={(m) => m.metricKey} dense
          onRowClick={(m) => setMetricKey(m.metricKey)} />
        <div className="border-t border-border p-2 lg:border-l lg:border-t-0">
          <div className="flex items-center justify-between gap-2 px-2 pt-1">
            <Select aria-label="Metric to chart" value={metricKey} onChange={(e) => setMetricKey(e.target.value)} className="w-56">
              {metrics.map((m) => <option key={m.metricKey} value={m.metricKey}>{m.label}</option>)}
            </Select>
          </div>
          {series.data && selected && (
            series.data.points.some((p) => p.value !== null) ? (
              <ChartPanelInner seriesData={series.data} unit={selected.unit} provider={account.provider} />
            ) : (
              <p className="px-3 py-10 text-center text-sm text-fg-2">{availabilityText(selected.availability, account.provider)}</p>
            )
          )}
        </div>
      </div>
    </section>
  );
}

function ChartPanelInner({ seriesData, unit, provider }: { seriesData: SeriesResponse; unit: MetricValue['unit']; provider: Provider }) {
  const points = seriesData.points.map((p) => ({ date: p.date, value: p.value }));
  return (
    <ChartPanel
      title={seriesData.label}
      description={`${PROVIDER_LABEL[provider]} · daily values`}
      lastSyncedAt={seriesData.lastFetchedAt}
      meta={<>
        <span>Source: {seriesData.apiSource}</span>
        {seriesData.firstDataDate && <span>History from {formatDay(seriesData.firstDataDate, 'd MMM yyyy')}</span>}
        {seriesData.demo && <span>Synthetic demo data</span>}
      </>}
      table={
        <table className="w-full text-xs"><caption className="sr-only">{seriesData.label} by day</caption>
          <thead><tr className="text-left text-fg-3"><th className="py-1">Date</th><th className="py-1 text-right">Value</th></tr></thead>
          <tbody>{seriesData.points.map((p) => <tr key={p.date} className="border-t border-border"><td className="py-1">{formatDay(p.date, 'EEE d MMM')}</td><td className="tabular py-1 text-right">{p.value === null ? availabilityText(p.availability, provider) : formatMetric(p.value, unit, false)}</td></tr>)}</tbody>
        </table>
      }
    >
      <TrendChart unit={unit} height={200} series={[{ key: 'v', label: seriesData.label, points }]} />
    </ChartPanel>
  );
}

const POST_METRIC: Record<Provider, { views: string; likes: string; comments: string }> = {
  INSTAGRAM: { views: 'instagram.post.views', likes: 'instagram.post.likes', comments: 'instagram.post.comments' },
  YOUTUBE: { views: 'youtube.post.views', likes: 'youtube.post.likes', comments: 'youtube.post.comments' },
  TIKTOK: { views: 'tiktok.post.view_count', likes: 'tiktok.post.like_count', comments: 'tiktok.post.comment_count' },
};

function ContentPerformance({ range, provider }: { range: { from: string; to: string }; provider: Provider | '' }) {
  const [page, setPage] = useUrlState('page', '0');
  const [sort, setSort] = useUrlState('sort', 'recent');
  const sortMetric = provider && sort !== 'recent' ? POST_METRIC[provider][sort as 'views' | 'likes' | 'comments'] : undefined;
  const params = { ...range, provider: provider || undefined, sortMetric, page: Number(page), size: 20 };
  const posts = useQuery({ queryKey: qk.posts(params), queryFn: () => analyticsApi.posts(params), placeholderData: keepPreviousData });

  const metric = (p: Post, kind: 'views' | 'likes' | 'comments') => {
    const v = p.metrics[POST_METRIC[p.provider][kind]];
    return v === undefined ? <span className="text-2xs text-fg-3">n/a</span> : formatMetric(v, 'COUNT');
  };
  const columns: Column<Post>[] = [
    { key: 'title', header: 'Content', cell: (p) => (
      <span className="flex min-w-[220px] items-center gap-2">
        <PlatformBadge provider={p.provider} compact />
        <span className="truncate">{p.title ?? 'Untitled'}</span>
        {p.permalink && !p.demo && <a href={p.permalink} target="_blank" rel="noreferrer" aria-label="Open on platform" className="text-fg-3 hover:text-fg"><ExternalLink className="h-3.5 w-3.5" /></a>}
      </span>
    ) },
    { key: 'account', header: 'Account', cell: (p) => <span className="text-xs text-fg-2">@{p.accountHandle}</span> },
    { key: 'type', header: 'Type', cell: (p) => <span className="text-xs">{CONTENT_TYPE_LABEL[p.contentType as keyof typeof CONTENT_TYPE_LABEL] ?? p.contentType}</span> },
    { key: 'published', header: 'Published', cell: (p) => <span className="whitespace-nowrap text-xs">{formatInstant(p.publishedAt, 'd MMM yyyy')}</span> },
    { key: 'views', header: 'Views', align: 'right', sortable: Boolean(provider), cell: (p) => metric(p, 'views') },
    { key: 'likes', header: 'Likes', align: 'right', sortable: Boolean(provider), cell: (p) => metric(p, 'likes') },
    { key: 'comments', header: 'Comments', align: 'right', sortable: Boolean(provider), cell: (p) => metric(p, 'comments') },
  ];

  return (
    <section className="panel">
      <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-2.5 text-xs text-fg-2">
        <BarChart3 className="h-4 w-4" aria-hidden />
        {provider ? 'Sort by a column to rank within this platform.' : 'Choose a platform above to rank by a metric — each platform defines views differently, so they are not ranked together.'}
        {sort !== 'recent' && provider && <button type="button" onClick={() => setSort('recent')} className="ml-auto text-accent hover:underline">Sort by most recent</button>}
      </div>
      {posts.isLoading ? <PanelSkeleton rows={6} className="border-0 shadow-none" /> : posts.error ? <ErrorState error={posts.error} onRetry={() => posts.refetch()} /> : (
        <>
          <DataTable caption="Content performance" columns={columns} rows={posts.data!.items} rowKey={(p) => p.id}
            sort={sort !== 'recent' ? { key: sort, direction: 'desc' } : undefined}
            onSort={(k) => { setSort(k); setPage('0'); }}
            empty={<EmptyState icon={BarChart3} title="No content in this range" description="Synced posts appear here after each sync." />} />
          <p className="px-4 py-1 text-2xs text-fg-3">Metrics are lifetime totals at the last sync. “n/a” means the platform does not provide that metric for this item.</p>
          <Pagination page={posts.data!.page} totalPages={posts.data!.totalPages} onChange={(p) => setPage(String(p))} />
        </>
      )}
    </section>
  );
}

function Definitions({ provider }: { provider: Provider | '' }) {
  const defs = useQuery({ queryKey: qk.metricDefinitions, queryFn: () => analyticsApi.metrics() });
  const rows = useMemo(() => (defs.data ?? []).filter((d) => !provider || d.provider === provider), [defs.data, provider]);
  const columns: Column<MetricDefinition>[] = [
    { key: 'p', header: 'Platform', cell: (d) => <PlatformBadge provider={d.provider} /> },
    { key: 'label', header: 'Metric', cell: (d) => <span className="font-medium">{d.label}</span> },
    { key: 'scope', header: 'Level', cell: (d) => <span className="text-xs">{d.scope === 'ACCOUNT' ? 'Account' : d.scope === 'POST' ? 'Content' : 'Audience'}</span> },
    { key: 'type', header: 'Type', cell: (d) => <span className="text-xs" title={d.measureType === 'STOCK' ? 'Point-in-time value' : 'Counted per day; summed over a range'}>{d.measureType === 'STOCK' ? 'Point in time' : 'Per day'}</span> },
    { key: 'desc', header: 'Definition', cell: (d) => <span className="text-xs text-fg-2">{d.description}</span> },
    { key: 'src', header: 'API source', cell: (d) => <code className="text-2xs text-fg-3">{d.apiSource}</code> },
  ];
  if (defs.isLoading) return <PanelSkeleton rows={8} />;
  if (defs.error) return <div className="panel"><ErrorState error={defs.error} onRetry={() => defs.refetch()} /></div>;
  return (
    <section className="panel">
      <p className="border-b border-border px-4 py-2.5 text-xs text-fg-2">Metrics with the same name on different platforms can have different definitions. Bloom only adds metrics together when their definition and unit match (e.g. Instagram and TikTok followers).</p>
      <DataTable caption="Metric definitions" columns={columns} rows={rows} rowKey={(d) => d.metricKey} dense />
    </section>
  );
}
