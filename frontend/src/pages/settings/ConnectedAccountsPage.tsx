import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, ChevronDown, ExternalLink, FlaskConical, KeyRound, Link2, MoreHorizontal, PlugZap, RefreshCw, Trash2, Unplug } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AccountAvatar, accountName } from '@/components/data/AccountAvatar';
import { DemoBadge } from '@/components/data/DemoNotice';
import { PlatformBadge, PlatformIcon } from '@/components/data/PlatformBadge';
import { SyncStatus, syncStateOf } from '@/components/data/SyncStatus';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Dialog';
import { Alert, EmptyState, ErrorState, PanelSkeleton, errorMessage } from '@/components/ui/Feedback';
import { Checkbox } from '@/components/ui/FormControls';
import { Menu } from '@/components/ui/Menu';
import { useToast } from '@/hooks/useToast';
import { useWorkspace } from '@/hooks/useWorkspace';
import { PageHeader } from '@/layouts/PageHeader';
import { accountsApi } from '@/services/bloomApi';
import type { Account, ConnectSession, Provider, ProviderInfo } from '@/types/api';
import { formatInstant, relativeTime } from '@/utils/dates';
import { CAPABILITY_LABEL, CONNECTION_STATUS_LABEL, PROVIDER_LABEL, scopeLabel } from '@/utils/labels';
import { qk } from '@/utils/queryKeys';

export default function ConnectedAccountsPage() {
  const { current } = useWorkspace();
  const providers = useQuery({ queryKey: qk.providers, queryFn: accountsApi.providers });
  const accounts = useQuery({
    queryKey: qk.accounts,
    queryFn: accountsApi.list,
    // Poll while any sync is running so status updates without a manual refresh.
    refetchInterval: (q) => ((q.state.data ?? []).some((a) => syncStateOf(a) === 'SYNCING') ? 3000 : false),
  });
  const [connecting, setConnecting] = useState<ProviderInfo | null>(null);

  return (
    <>
      <PageHeader title="Connected accounts"
        description={current?.demo
          ? 'The demo workspace holds synthetic accounts only. Switch to “My workspace” to connect real accounts.'
          : 'Connect Instagram, YouTube and TikTok with their official sign-in. Bloom only reads data; it never posts.'} />
      <div className="space-y-6">
        <ReturnFromProvider />
        <section aria-labelledby="providers-heading">
          <h3 id="providers-heading" className="mb-2 text-sm font-semibold">Platforms</h3>
          {providers.isLoading ? <PanelSkeleton rows={3} /> : providers.error ? <div className="panel"><ErrorState error={providers.error} onRetry={() => providers.refetch()} /></div> : (
            <>
              {!providers.data![0]?.integrationReachable && !current?.demo && (
                <Alert tone="warning" className="mb-3" title="Integration service not reachable">Live connections need the integration service (integration-node). Demo data and everything else keep working.</Alert>
              )}
              <div className="grid gap-3 lg:grid-cols-3">
                {providers.data!.map((p) => <ProviderTile key={p.provider} info={p} demoWorkspace={Boolean(current?.demo)} onConnect={() => setConnecting(p)} />)}
              </div>
            </>
          )}
        </section>
        <section aria-labelledby="accounts-heading">
          <h3 id="accounts-heading" className="mb-2 text-sm font-semibold">Accounts in {current?.name}</h3>
          {accounts.isLoading ? <PanelSkeleton rows={3} /> : accounts.error ? <div className="panel"><ErrorState error={accounts.error} onRetry={() => accounts.refetch()} /></div>
            : accounts.data!.length === 0 ? (
              <div className="panel"><EmptyState icon={Link2} title="No accounts connected yet" description="Choose a platform above. You'll see exactly what Bloom will access before you're sent to the platform." /></div>
            ) : (
              <ul className="space-y-3">{accounts.data!.map((a) => <AccountRow key={a.id} account={a} providers={providers.data ?? []} onReconnect={(p) => setConnecting(p)} />)}</ul>
            )}
        </section>
      </div>
      <ConnectDialog info={connecting} onOpenChange={(o) => !o && setConnecting(null)} />
    </>
  );
}

function ProviderTile({ info, demoWorkspace, onConnect }: { info: ProviderInfo; demoWorkspace: boolean; onConnect: () => void }) {
  const client = useQueryClient();
  const toast = useToast();
  const addDemo = useMutation({
    mutationFn: () => accountsApi.addDemo(info.provider),
    onSuccess: async (a) => { await client.invalidateQueries(); toast.success(`Added demo account ${accountName(a)}`); },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const ready = info.liveConfigured && info.integrationReachable;
  return (
    <article className="panel flex flex-col p-4">
      <div className="flex items-center gap-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-md border border-border bg-surface-2"><PlatformIcon provider={info.provider} /></span>
        <div className="min-w-0 flex-1">
          <h4 className="text-sm font-semibold">{info.displayName}</h4>
          <p className="truncate text-2xs text-fg-3">{info.apiFamily}</p>
        </div>
        {!info.docsVerified && <Badge tone="warning" title="Official docs could not be re-verified on the last check; see docs/integrations">Docs re-check pending</Badge>}
      </div>
      <ul className="mt-3 space-y-1 text-xs text-fg-2">
        {info.dataAccessed.map((d) => <li key={d} className="flex gap-1.5"><span aria-hidden className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-accent" />{d}</li>)}
      </ul>
      <p className="mt-2 text-2xs text-fg-3">Not available: {info.notAvailable.join('; ')}.</p>
      <div className="mt-auto flex flex-wrap items-center gap-2 pt-4">
        {demoWorkspace ? (
          <Button size="sm" onClick={() => addDemo.mutate()} loading={addDemo.isPending}><FlaskConical /> Add demo account</Button>
        ) : ready ? (
          <Button size="sm" variant="primary" onClick={onConnect}><Link2 /> Connect {info.displayName}</Button>
        ) : (
          <div className="space-y-1">
            <Button size="sm" variant="primary" disabled><Link2 /> Connect {info.displayName}</Button>
            <p className="text-2xs text-fg-3">
              {!info.integrationReachable ? 'Integration service offline.' : `Not configured: ${info.missingConfig.join(', ')}.`} See {info.docsPath}.
            </p>
          </div>
        )}
      </div>
    </article>
  );
}

/** Explains requested access and prerequisites BEFORE redirecting to the provider's official consent page. */
function ConnectDialog({ info, onOpenChange }: { info: ProviderInfo | null; onOpenChange: (o: boolean) => void }) {
  const start = useMutation({
    mutationFn: () => accountsApi.startConnection(info!.provider),
    onSuccess: (r) => { window.location.assign(r.authorizationUrl); },
  });
  useEffect(() => { if (info) start.reset(); }, [info]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!info) return null;
  return (
    <Modal open onOpenChange={onOpenChange} title={`Connect ${info.displayName}`} description={info.accessExplanation} size="lg"
      footer={<><Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button><Button variant="primary" loading={start.isPending || start.isSuccess} onClick={() => start.mutate()}>Continue to {info.displayName} <ExternalLink /></Button></>}>
      <div className="space-y-4 text-sm">
        {start.error ? <Alert tone="danger" title="Couldn't start the connection">{errorMessage(start.error)}</Alert> : null}
        <section>
          <h4 className="label mb-1">Permissions requested</h4>
          <ul className="space-y-1">{info.requestedScopes.map((s) => <li key={s} className="flex items-center gap-2"><KeyRound className="h-3.5 w-3.5 text-fg-3" aria-hidden />{scopeLabel(s)} <code className="text-2xs text-fg-3">{s}</code></li>)}</ul>
        </section>
        <section>
          <h4 className="label mb-1">Before you continue</h4>
          <ul className="list-disc space-y-1 pl-5 text-fg-2">{info.prerequisites.map((p) => <li key={p}>{p}</li>)}</ul>
        </section>
        <p className="text-xs text-fg-3">You'll sign in on {info.displayName}'s own page. Bloom never sees your password; access tokens are encrypted on the server and never shown in the browser. You can disconnect at any time.</p>
      </div>
    </Modal>
  );
}

const CONNECT_ERRORS: Record<string, string> = {
  STATE_INVALID: 'The connection link was invalid or tampered with. Start again.',
  STATE_EXPIRED: 'The connection attempt expired. Start again.',
  STATE_ALREADY_USED: 'That connection link was already used. Start again if the account is not listed.',
  MISSING_STATE: 'The platform returned without the security check. Start again.',
  access_denied: 'You cancelled on the platform. Nothing was connected.',
};

/** Handles the redirect back from the provider: success, failure or choosing between several identities. */
function ReturnFromProvider() {
  const client = useQueryClient();
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const sessionId = params.get('session');
  const connectError = params.get('connectError');
  const session = useQuery({ queryKey: qk.session(sessionId ?? ''), queryFn: () => accountsApi.session(sessionId!), enabled: Boolean(sessionId) });
  const [chosen, setChosen] = useState<string[]>([]);
  const select = useMutation({
    mutationFn: () => accountsApi.selectIdentities(sessionId!, chosen),
    onSuccess: async () => { await client.invalidateQueries(); toast.success('Account connected. The first sync has started.'); },
  });
  const cancel = useMutation({ mutationFn: () => accountsApi.cancelSession(sessionId!), onSuccess: () => dismiss() });
  const dismiss = () => setParams((p) => { const n = new URLSearchParams(p); n.delete('session'); n.delete('connectError'); return n; }, { replace: true });

  useEffect(() => {
    if (session.data?.status === 'COMPLETED') void client.invalidateQueries({ queryKey: qk.accounts });
  }, [session.data?.status, client]);

  if (connectError) {
    return <Alert tone="danger" title="The account was not connected" action={<Button size="sm" onClick={dismiss}>Dismiss</Button>}>{CONNECT_ERRORS[connectError] ?? `The connection failed (${connectError}).`}</Alert>;
  }
  if (!sessionId) return null;
  if (session.isLoading) return <PanelSkeleton rows={1} />;
  if (session.error) return <Alert tone="danger" title="Couldn't read the connection result" action={<Button size="sm" onClick={dismiss}>Dismiss</Button>}>{errorMessage(session.error)}</Alert>;
  const s = session.data as ConnectSession;
  const provider = PROVIDER_LABEL[s.provider];

  if (s.status === 'AWAITING_SELECTION') {
    return (
      <section className="panel space-y-3 p-4" aria-labelledby="choose-identity">
        <h3 id="choose-identity" className="text-sm font-semibold">Choose which {provider} account{s.candidates.length > 1 ? 's' : ''} to connect</h3>
        <p className="text-xs text-fg-2">{provider} returned several accounts for this sign-in.</p>
        <ul className="space-y-2">
          {s.candidates.map((c) => (
            <li key={c.providerAccountId} className="flex items-center gap-3">
              <Checkbox disabled={!c.eligible} checked={chosen.includes(c.providerAccountId)}
                onChange={(e) => setChosen((x) => (e.target.checked ? [...x, c.providerAccountId] : x.filter((y) => y !== c.providerAccountId)))}
                label={<span className="flex items-center gap-2"><AccountAvatar name={c.handle ?? '?'} avatarUrl={c.avatarUrl} provider={s.provider} size="sm" />{c.displayName ?? c.handle} {c.handle && <span className="text-xs text-fg-3">@{c.handle}</span>}</span>} />
              {!c.eligible && <span className="text-xs text-warning">{c.ineligibleReason}</span>}
            </li>
          ))}
        </ul>
        {select.error ? <Alert tone="danger">{errorMessage(select.error)}</Alert> : null}
        <div className="flex gap-2">
          <Button variant="primary" disabled={chosen.length === 0} loading={select.isPending} onClick={() => select.mutate()}>Connect selected</Button>
          <Button variant="ghost" loading={cancel.isPending} onClick={() => cancel.mutate()}>Cancel</Button>
        </div>
      </section>
    );
  }
  if (s.status === 'COMPLETED') {
    return <Alert tone="accent" title={`${provider} connected`} action={<Button size="sm" onClick={dismiss}>Done</Button>}>The first sync runs in the background. Data appears as soon as it's stored.</Alert>;
  }
  return (
    <Alert tone="danger" title={`${provider} was not connected`} action={<Button size="sm" onClick={dismiss}>Dismiss</Button>}>
      {s.errorMessage ?? CONNECT_ERRORS[s.errorCode ?? ''] ?? 'The connection did not complete.'}
    </Alert>
  );
}

function AccountRow({ account: a, providers, onReconnect }: { account: Account; providers: ProviderInfo[]; onReconnect: (p: ProviderInfo) => void }) {
  const client = useQueryClient();
  const toast = useToast();
  const [expanded, setExpanded] = useState(false);
  const [disconnectOpen, setDisconnectOpen] = useState(false);
  const [deleteHistory, setDeleteHistory] = useState(false);
  const state = syncStateOf(a);
  const info = providers.find((p) => p.provider === a.provider);
  const jobs = useQuery({ queryKey: qk.accountJobs(a.id), queryFn: () => accountsApi.jobs(a.id), enabled: expanded });
  const invalidate = () => client.invalidateQueries();

  const sync = useMutation({ mutationFn: () => accountsApi.sync(a.id), onSuccess: async () => { await invalidate(); toast.info('Sync started'); }, onError: (e) => toast.error(errorMessage(e)) });
  const disconnect = useMutation({
    mutationFn: () => accountsApi.disconnect(a.id, deleteHistory),
    onSuccess: async (r) => { setDisconnectOpen(false); await invalidate(); toast.success(r.note); },
  });
  const remove = useMutation({ mutationFn: () => accountsApi.remove(a.id), onSuccess: async () => { await invalidate(); toast.success('Account removed'); }, onError: (e) => toast.error(errorMessage(e)) });
  const canReconnect = a.dataMode === 'LIVE' && info && (a.needsReconnect || a.connectionStatus === 'DISCONNECTED');

  return (
    <li className="panel">
      <div className="flex flex-wrap items-center gap-3 p-4">
        <AccountAvatar name={accountName(a)} avatarUrl={a.avatarUrl} provider={a.provider} />
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-2 text-sm font-semibold">{a.displayName ?? accountName(a)} {a.dataMode === 'DEMO' && <DemoBadge />}</p>
          <p className="text-xs text-fg-2"><PlatformBadge provider={a.provider} /> · {accountName(a)} · {CONNECTION_STATUS_LABEL[a.connectionStatus]}</p>
        </div>
        <SyncStatus state={state} lastSuccessfulSyncAt={a.lastSuccessfulSyncAt} detail={a.lastSyncError} />
        <div className="flex items-center gap-1.5">
          {canReconnect ? <Button size="sm" variant="primary" onClick={() => onReconnect(info!)}><PlugZap /> Reconnect</Button>
            : a.connectionStatus !== 'DISCONNECTED' && !a.needsReconnect && (
              <Button size="sm" onClick={() => sync.mutate()} loading={sync.isPending} disabled={state === 'SYNCING'}><RefreshCw /> Sync now</Button>
            )}
          <Menu label={`Actions for ${accountName(a)}`} trigger={<Button size="sm" variant="ghost" aria-label="More actions"><MoreHorizontal /></Button>} items={[
            ...(a.connectionStatus !== 'DISCONNECTED' ? [{ label: 'Disconnect…', icon: <Unplug />, onSelect: () => setDisconnectOpen(true) }] : []),
            ...(a.dataMode === 'DEMO' || a.connectionStatus === 'DISCONNECTED' ? [{ label: 'Remove with history', icon: <Trash2 />, destructive: true, onSelect: () => remove.mutate() }] : []),
          ]} />
        </div>
      </div>
      {(a.needsReconnect || a.connectionStatus === 'ERROR') && a.lastSyncError && (
        <div className="px-4 pb-3"><Alert tone={a.needsReconnect ? 'danger' : 'warning'} title={a.needsReconnect ? 'Reconnection needed' : 'Last sync failed'}>{a.lastSyncError}</Alert></div>
      )}
      <button type="button" onClick={() => setExpanded((e) => !e)} aria-expanded={expanded}
        className="flex w-full items-center gap-1 border-t border-border px-4 py-2 text-xs text-fg-2 hover:text-fg">
        <ChevronDown className={expanded ? 'h-3.5 w-3.5 rotate-180 transition-transform' : 'h-3.5 w-3.5 transition-transform'} aria-hidden /> Permissions, capabilities and sync history
      </button>
      {expanded && (
        <div className="grid gap-4 border-t border-border px-4 py-3 text-xs md:grid-cols-3">
          <div>
            <h4 className="label mb-1">Granted permissions</h4>
            {a.grantedScopes.length === 0 ? <p className="text-fg-3">{a.dataMode === 'DEMO' ? 'None — synthetic account' : 'None recorded'}</p>
              : <ul className="space-y-0.5">{a.grantedScopes.map((s) => <li key={s}>{scopeLabel(s)}</li>)}</ul>}
            {a.tokenExpiresAt && <p className="mt-2 text-fg-3">Access token expires {formatInstant(a.tokenExpiresAt, 'd MMM yyyy')} (refreshed automatically when possible)</p>}
          </div>
          <div>
            <h4 className="label mb-1">Capabilities</h4>
            <ul className="flex flex-wrap gap-1">{a.capabilities.map((c) => <Badge key={c} tone="outline">{CAPABILITY_LABEL[c] ?? c}</Badge>)}</ul>
            {info && <p className="mt-2 text-fg-3">Not available from {info.displayName}: {info.notAvailable.slice(0, 3).join('; ')}</p>}
          </div>
          <div>
            <h4 className="label mb-1">Recent syncs</h4>
            {jobs.isLoading ? <p className="text-fg-3">Loading…</p> : (
              <ul className="space-y-1">
                {(jobs.data ?? []).map((j) => (
                  <li key={j.id} className="flex items-center gap-2">
                    {j.status === 'FAILED' ? <AlertTriangle className="h-3 w-3 text-danger" aria-hidden /> : <RefreshCw className="h-3 w-3 text-fg-3" aria-hidden />}
                    <span className="flex-1">{j.status.toLowerCase()} · {j.trigger.toLowerCase()}{j.errorCode ? ` · ${j.errorCode}` : ''}</span>
                    <span className="text-fg-3">{relativeTime(j.finishedAt ?? j.createdAt)}</span>
                  </li>
                ))}
                {jobs.data?.length === 0 && <li className="text-fg-3">No syncs yet</li>}
              </ul>
            )}
          </div>
        </div>
      )}
      <Modal open={disconnectOpen} onOpenChange={setDisconnectOpen} title={`Disconnect ${accountName(a)}?`}
        description={a.dataMode === 'DEMO' ? 'This is a demo account; no provider credentials exist.' : `Bloom will ask ${PROVIDER_LABEL[a.provider as Provider]} to revoke access where it supports that, and delete the stored tokens.`}
        footer={<><Button variant="ghost" onClick={() => setDisconnectOpen(false)}>Cancel</Button><Button variant="destructive" loading={disconnect.isPending} onClick={() => disconnect.mutate()}>Disconnect</Button></>}>
        <div className="space-y-3">
          {disconnect.error ? <Alert tone="danger">{errorMessage(disconnect.error)}</Alert> : null}
          <Checkbox checked={deleteHistory} onChange={(e) => setDeleteHistory(e.target.checked)} label="Also delete all synced history for this account" />
          <p className="text-xs text-fg-2">{deleteHistory ? 'Snapshots, posts and metrics from this account are permanently deleted.' : 'Historical snapshots stay visible and are labelled as coming from a disconnected account. Goals linked to it stop updating.'}</p>
        </div>
      </Modal>
    </li>
  );
}
