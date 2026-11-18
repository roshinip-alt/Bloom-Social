import { useQuery } from '@tanstack/react-query';
import { CalendarCheck2, ExternalLink, Link2, Target } from 'lucide-react';
import { Link } from 'react-router-dom';
import { TrendChart } from '@/components/charts/TrendChart';
import { AccountAvatar, accountName } from '@/components/data/AccountAvatar';
import { DemoNotice } from '@/components/data/DemoNotice';
import { GoalProgress, GoalStateBadge } from '@/components/data/GoalProgressRow';
import { MetricCard } from '@/components/data/MetricCard';
import { PlatformBadge } from '@/components/data/PlatformBadge';
import { SyncStatus } from '@/components/data/SyncStatus';
import { TaskRow } from '@/components/data/TaskRow';
import { buttonVariants } from '@/components/ui/Button';
import { DateRangePicker } from '@/components/ui/DateRangePicker';
import { Alert, EmptyState, ErrorState, PanelSkeleton } from '@/components/ui/Feedback';
import { Select } from '@/components/ui/FormControls';
import { useDateRange } from '@/hooks/useDateRange';
import { useUrlState } from '@/hooks/useUrlState';
import { PageHeader } from '@/layouts/PageHeader';
import { dashboardApi } from '@/services/bloomApi';
import type { Aggregate, DashboardResponse } from '@/types/api';
import { cn } from '@/utils/cn';
import { formatDay, formatInstant } from '@/utils/dates';
import { formatMetric } from '@/utils/format';
import { availabilityText, PROVIDER_LABEL } from '@/utils/labels';
import { qk } from '@/utils/queryKeys';

export default function DashboardPage() {
  const { preset, range, setPreset, setCustom } = useDateRange();
  const [accountId, setAccountId] = useUrlState('account', '');
  const params = { ...range, accountId: accountId || undefined };
  const query = useQuery({ queryKey: qk.dashboard(params), queryFn: () => dashboardApi.get(params) });
  const allAccounts = useQuery({ queryKey: qk.dashboard({ ...range }), queryFn: () => dashboardApi.get(range), enabled: Boolean(accountId) });
  const accountOptions = (accountId ? allAccounts.data : query.data)?.accounts ?? [];

  return (
    <>
      <PageHeader
        title="Dashboard"
        description="Cross-platform overview. Totals only combine metrics with the same definition."
        actions={
          <>
            <Select aria-label="Account filter" value={accountId} onChange={(e) => setAccountId(e.target.value)} className="w-52">
              <option value="">All accounts</option>
              {accountOptions.map((h) => (
                <option key={h.account.id} value={h.account.id}>{`${PROVIDER_LABEL[h.account.provider]} · ${accountName(h.account)}`}</option>
              ))}
            </Select>
          </>
        }
      >
        <DateRangePicker preset={preset} range={range} onPreset={setPreset} onCustom={setCustom} />
      </PageHeader>
      <div className="space-y-4">
        <DemoNotice />
        {query.isLoading ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{[0, 1, 2].map((i) => <PanelSkeleton key={i} rows={2} />)}</div>
        ) : query.error ? (
          <div className="panel"><ErrorState error={query.error} onRetry={() => query.refetch()} /></div>
        ) : query.data ? (
          <DashboardBody data={query.data} />
        ) : null}
      </div>
    </>
  );
}

function DashboardBody({ data }: { data: DashboardResponse }) {
  const attention = data.accounts.filter((a) => ['NEEDS_RECONNECT', 'ERROR', 'STALE', 'DISCONNECTED'].includes(a.syncState));
  return (
    <>
      {data.accounts.length === 0 ? (
        <div className="panel">
          <EmptyState
            icon={Link2}
            title="Connect an account to see performance"
            description="Planning, goals and earnings work without it, but followers, views and top content need a connected account."
            action={<Link to="/settings/connected-accounts" className={buttonVariants({ variant: 'primary' })}>Connect an account</Link>}
          />
        </div>
      ) : (
        <>
          {attention.length > 0 && (
            <Alert
              tone="warning"
              title="Partial coverage"
              action={<Link to="/settings/connected-accounts" className={buttonVariants({ size: 'sm' })}>Review accounts</Link>}
            >
              {attention.map((a) => `${accountName(a.account)} (${a.syncState === 'NEEDS_RECONNECT' ? 'needs reconnecting' : a.syncState.toLowerCase().replace('_', ' ')})`).join(', ')}
              {' '}— figures below only include data synced up to each account's last successful sync.
            </Alert>
          )}
          <SyncHealth data={data} />
          <section aria-label="Headline metrics" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {data.headline.map((a) => <HeadlineCard key={a.canonicalKey} aggregate={a} data={data} />)}
          </section>
          <AudienceTrend data={data} />
        </>
      )}
      <div className="grid gap-4 lg:grid-cols-2">
        <TopContent data={data} />
        <PublishedPanel data={data} />
        <UpcomingTasks data={data} />
        <GoalsPanel data={data} />
      </div>
    </>
  );
}

function SyncHealth({ data }: { data: DashboardResponse }) {
  return (
    <section className="panel" aria-labelledby="sync-health">
      <h3 id="sync-health" className="sr-only">Sync health</h3>
      <ul className="grid gap-px overflow-hidden rounded-lg bg-border sm:grid-cols-2 xl:grid-cols-4">
        {data.accounts.map((h) => (
          <li key={h.account.id} className="flex items-center gap-2.5 bg-surface px-4 py-2.5">
            <AccountAvatar name={accountName(h.account)} avatarUrl={h.account.avatarUrl} provider={h.account.provider} size="sm" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-medium">{accountName(h.account)}</p>
              <p className="text-2xs text-fg-3">{PROVIDER_LABEL[h.account.provider]}{h.account.dataMode === 'DEMO' ? ' · demo' : ''}</p>
            </div>
            <SyncStatus state={h.syncState} lastSuccessfulSyncAt={h.lastSuccessfulSyncAt} detail={h.lastSyncError} />
          </li>
        ))}
      </ul>
    </section>
  );
}

function HeadlineCard({ aggregate: a, data }: { aggregate: Aggregate; data: DashboardResponse }) {
  const platformSpecific = !['followers', 'subscribers'].includes(a.canonicalKey);
  const provider = (a.contributors[0] ?? a.missing[0])?.account.provider;
  const label = platformSpecific && provider ? `${PROVIDER_LABEL[provider]} ${a.label.toLowerCase()}` : a.label;
  const total = a.contributors.length + a.missing.length;
  return (
    <MetricCard
      label={label}
      value={a.value}
      unit={a.unit}
      definition={`${a.description} ${a.measureType === 'STOCK' ? 'Value at the end of the period.' : 'Summed over the period.'}`}
      previousValue={a.previousValue}
      change={a.change}
      comparisonLabel={`vs ${formatDay(data.previousFrom)} – ${formatDay(data.previousTo)}`}
      unavailableReason={a.missing[0] ? availabilityText(a.missing[0].reason, a.missing[0].account.provider) : 'No data yet'}
      footer={
        <div className="space-y-0.5">
          <p>
            From {a.contributors.length} of {total} account{total === 1 ? '' : 's'}
            {a.contributors.length > 0 && `: ${a.contributors.map((c) => accountName(c.account)).join(', ')}`}
          </p>
          {a.missing.map((m) => (
            <p key={m.account.id} className="text-fg-3">{accountName(m.account)}: {availabilityText(m.reason, m.account.provider)}</p>
          ))}
          {a.notReportedBy.length > 0 && (
            <p className="text-fg-3">Not reported by {Array.from(new Set(a.notReportedBy.map((r) => PROVIDER_LABEL[r.provider]))).join(', ')}</p>
          )}
        </div>
      }
    />
  );
}

/** Small multiples: one chart per account so different audience definitions never share an axis. */
function AudienceTrend({ data }: { data: DashboardResponse }) {
  if (data.audienceTrend.length === 0) return null;
  return (
    <section aria-labelledby="audience-trend">
      <h3 id="audience-trend" className="mb-2 text-sm font-semibold">Audience growth</h3>
      <div className="grid gap-3 md:grid-cols-2">
        {data.audienceTrend.map((s) => {
          const withData = s.points.filter((p) => p.value !== null);
          const first = withData[0]?.value ?? null;
          const last = withData[withData.length - 1]?.value ?? null;
          return (
            <div key={s.account.id} className="panel p-3">
              <div className="flex items-center justify-between gap-2 px-1">
                <p className="truncate text-xs font-medium">{accountName(s.account)} · {s.label}</p>
                <PlatformBadge provider={s.account.provider} compact />
              </div>
              <p className="tabular px-1 text-lg font-semibold">{formatMetric(last, 'COUNT')}
                {first !== null && last !== null && (
                  <span className={cn('ml-2 text-xs font-medium', last >= first ? 'text-accent' : 'text-danger')}>
                    {last >= first ? '+' : '−'}{formatMetric(Math.abs(last - first), 'COUNT')} in range
                  </span>
                )}
              </p>
              {withData.length === 0 ? (
                <p className="px-1 py-6 text-xs text-fg-2">No synced data in this range.</p>
              ) : (
                <TrendChart unit="COUNT" height={120} series={[{ key: 'v', label: s.label, points: s.points }]} />
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

function TopContent({ data }: { data: DashboardResponse }) {
  return (
    <section className="panel p-4" aria-labelledby="top-content">
      <div className="mb-2 flex items-center justify-between">
        <h3 id="top-content" className="text-sm font-semibold">Top content</h3>
        <Link to="/analytics?tab=content" className="text-xs text-accent hover:underline">All content</Link>
      </div>
      <p className="mb-2 text-2xs text-fg-3">Ranked within each platform by its own views metric — platforms are not compared.</p>
      {data.topContent.length === 0 ? (
        <p className="py-6 text-center text-sm text-fg-2">No posts published in this range.</p>
      ) : (
        <div className="space-y-3">
          {data.topContent.map((group) => (
            <div key={group.provider}>
              <PlatformBadge provider={group.provider} className="mb-1" />
              <ol className="divide-y divide-border">
                {group.posts.map((p) => (
                  <li key={p.id} className="flex items-center gap-2 py-1.5 text-sm">
                    <span className="min-w-0 flex-1 truncate">{p.title ?? 'Untitled'}</span>
                    <span className="tabular shrink-0 text-xs text-fg-2">{formatMetric(p.metrics[group.metricKey] ?? null, 'COUNT')} views</span>
                    {p.permalink && !p.demo && (
                      <a href={p.permalink} target="_blank" rel="noreferrer" className="text-fg-3 hover:text-fg" aria-label={`Open "${p.title}" on ${PROVIDER_LABEL[group.provider]}`}>
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    )}
                  </li>
                ))}
              </ol>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function PublishedPanel({ data }: { data: DashboardResponse }) {
  const { syncedPosts, manuallyRecordedDrafts } = data.contentPublished;
  return (
    <section className="panel p-4" aria-labelledby="published">
      <h3 id="published" className="mb-2 text-sm font-semibold">Content published</h3>
      <ul className="divide-y divide-border">
        {syncedPosts.map((c) => (
          <li key={c.account.id} className="flex items-center justify-between py-1.5 text-sm">
            <span className="flex items-center gap-2"><PlatformBadge provider={c.account.provider} compact />{accountName(c.account)}</span>
            <span className="tabular font-medium">{c.posts}</span>
          </li>
        ))}
        <li className="flex items-center justify-between py-1.5 text-sm">
          <span className="text-fg-2">Recorded manually in Content Studio</span>
          <span className="tabular font-medium">{manuallyRecordedDrafts}</span>
        </li>
      </ul>
      <p className="mt-2 text-2xs text-fg-3">Synced posts come from the platforms; manual records are drafts you marked as published.</p>
    </section>
  );
}

function UpcomingTasks({ data }: { data: DashboardResponse }) {
  return (
    <section className="panel p-4" aria-labelledby="upcoming">
      <div className="mb-2 flex items-center justify-between">
        <h3 id="upcoming" className="text-sm font-semibold">Upcoming in Planly</h3>
        <Link to="/planly?view=agenda" className="text-xs text-accent hover:underline">Open Planly</Link>
      </div>
      {data.overdueTasks > 0 && (
        <p className="mb-2 text-xs font-medium text-danger">{data.overdueTasks} overdue task{data.overdueTasks > 1 ? 's' : ''}</p>
      )}
      {data.upcomingTasks.length === 0 ? (
        <EmptyState icon={CalendarCheck2} title="Nothing due this week" action={<Link to="/planly?new=task" className={buttonVariants({ size: 'sm' })}>Add a task</Link>} className="py-6" />
      ) : (
        <div className="divide-y divide-border">{data.upcomingTasks.map((t) => <TaskRow key={t.id} task={t} />)}</div>
      )}
    </section>
  );
}

function GoalsPanel({ data }: { data: DashboardResponse }) {
  return (
    <section className="panel p-4" aria-labelledby="goal-progress">
      <div className="mb-2 flex items-center justify-between">
        <h3 id="goal-progress" className="text-sm font-semibold">Goal progress</h3>
        <Link to="/goals" className="text-xs text-accent hover:underline">All goals</Link>
      </div>
      {data.goals.length === 0 ? (
        <EmptyState icon={Target} title="No active goals" action={<Link to="/goals?new=goal" className={buttonVariants({ size: 'sm' })}>Set a goal</Link>} className="py-6" />
      ) : (
        <ul className="space-y-3">
          {data.goals.map((g) => (
            <li key={g.id}>
              <div className="mb-1 flex items-center justify-between gap-2">
                <Link to={`/goals?goal=${g.id}`} className="truncate text-sm hover:underline">{g.title}</Link>
                <GoalStateBadge state={g.state} />
              </div>
              <GoalProgress goal={g} />
              {g.progressSource === 'ANALYTICS' && g.linkedMetric && (
                <p className="mt-0.5 text-2xs text-fg-3">Synced from {g.linkedMetric.provider ? PROVIDER_LABEL[g.linkedMetric.provider] : 'analytics'} · {g.linkedMetric.label} · updated {formatInstant(g.updatedAt, 'd MMM')}</p>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
