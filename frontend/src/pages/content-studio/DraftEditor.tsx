import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, Copy, History, Link2, MoreHorizontal, RotateCcw, Trash2, Undo2 } from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import { PlatformBadge } from '@/components/data/PlatformBadge';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog, Drawer, Modal } from '@/components/ui/Dialog';
import { Alert, ErrorState, PanelSkeleton, errorMessage } from '@/components/ui/Feedback';
import { Checkbox, FormField, Input, Select, Textarea } from '@/components/ui/FormControls';
import { Menu } from '@/components/ui/Menu';
import { Tabs, TabsContent, TabsList } from '@/components/ui/Tabs';
import { useToast } from '@/hooks/useToast';
import { ApiError } from '@/services/apiClient';
import { analyticsApi, brandApi, contentApi, goalsApi } from '@/services/bloomApi';
import type { ContentType, Draft, DraftInput, DraftStage, Provider } from '@/types/api';
import { PROVIDERS } from '@/types/api';
import { formatInstant, shiftDate, todayLocal } from '@/utils/dates';
import { CONTENT_TYPES, CONTENT_TYPE_LABEL, DRAFT_STAGE_LABEL, PROVIDER_LABEL } from '@/utils/labels';
import { qk } from '@/utils/queryKeys';

const blank = (): DraftInput => ({ title: '', platform: 'INSTAGRAM', contentType: 'REEL', caption: '', script: '', hashtags: [], notes: '', plannedDate: null, goalId: null, campaignId: null });

function useInvalidate() {
  const client = useQueryClient();
  return async () => {
    await client.invalidateQueries({ queryKey: ['content'] });
    void client.invalidateQueries({ queryKey: ['dashboard'] });
  };
}

/** Create a draft (draftId null) or edit an existing one with stage, publication, repurposing and versions. */
export function DraftEditor({ draftId, creating, onClose, onCreated }: { draftId: string | null; creating: boolean; onClose: () => void; onCreated: (d: Draft) => void }) {
  const open = creating || Boolean(draftId);
  const draft = useQuery({ queryKey: qk.draft(draftId ?? ''), queryFn: () => contentApi.draft(draftId!), enabled: Boolean(draftId) });
  return (
    <Drawer open={open} onOpenChange={(o) => !o && onClose()} width="lg" title={creating ? 'New draft' : draft.data?.title ?? 'Draft'}
      description={draft.data ? `${PROVIDER_LABEL[draft.data.platform]} ${CONTENT_TYPE_LABEL[draft.data.contentType].toLowerCase()} · ${DRAFT_STAGE_LABEL[draft.data.stage]} · v${draft.data.currentVersion}` : undefined}>
      {creating ? <DraftForm draft={null} onSaved={onCreated} onCancel={onClose} />
        : draft.isLoading ? <PanelSkeleton /> : draft.error || !draft.data ? <ErrorState error={draft.error} onRetry={() => draft.refetch()} />
          : (
            <Tabs defaultValue="edit">
              <TabsList items={[{ value: 'edit', label: 'Draft' }, { value: 'publish', label: 'Publication' }, { value: 'versions', label: 'Versions' }]} />
              <TabsContent value="edit" className="pt-4"><DraftForm draft={draft.data} onSaved={() => undefined} onCancel={onClose} onDeleted={onClose} /></TabsContent>
              <TabsContent value="publish" className="pt-4"><PublicationPanel draft={draft.data} /></TabsContent>
              <TabsContent value="versions" className="pt-4"><VersionsPanel draft={draft.data} /></TabsContent>
            </Tabs>
          )}
    </Drawer>
  );
}

function DraftForm({ draft, onSaved, onCancel, onDeleted }: { draft: Draft | null; onSaved: (d: Draft) => void; onCancel: () => void; onDeleted?: () => void }) {
  const toast = useToast();
  const invalidate = useInvalidate();
  const [form, setForm] = useState<DraftInput>(blank());
  const [hashtags, setHashtags] = useState('');
  const [repurposeOpen, setRepurposeOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const goals = useQuery({ queryKey: qk.goals(['ACTIVE']), queryFn: () => goalsApi.list(['ACTIVE']) });
  const campaigns = useQuery({ queryKey: qk.campaigns, queryFn: () => brandApi.campaigns() });

  useEffect(() => {
    if (draft) {
      setForm({ title: draft.title, platform: draft.platform, contentType: draft.contentType, caption: draft.caption ?? '', script: draft.script ?? '', hashtags: draft.hashtags, notes: draft.notes ?? '', plannedDate: draft.plannedDate, goalId: draft.goalId, campaignId: draft.campaignId, changeSummary: '' });
      setHashtags(draft.hashtags.map((h) => `#${h}`).join(' '));
    } else {
      setForm(blank());
      setHashtags('');
    }
  }, [draft]);

  const save = useMutation({
    mutationFn: () => {
      const body: DraftInput = { ...form, hashtags: hashtags.split(/[\s,]+/).filter(Boolean), caption: form.caption || null, script: form.script || null, notes: form.notes || null };
      return draft ? contentApi.updateDraft(draft.id, body) : contentApi.createDraft(body);
    },
    onSuccess: async (saved) => {
      await invalidate();
      toast.success(draft ? `Saved as version ${saved.currentVersion}` : 'Draft created');
      setForm((f) => ({ ...f, changeSummary: '' }));
      onSaved(saved);
    },
  });
  const stage = useMutation({
    mutationFn: (s: DraftStage) => contentApi.moveStage(draft!.id, s),
    onSuccess: async (d) => { await invalidate(); toast.success(`Moved to ${DRAFT_STAGE_LABEL[d.stage]}`); },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const remove = useMutation({
    mutationFn: () => contentApi.deleteDraft(draft!.id),
    onSuccess: async () => { setConfirmDelete(false); await invalidate(); toast.success('Draft deleted'); onDeleted?.(); },
  });

  const set = <K extends keyof DraftInput>(k: K, v: DraftInput[K]) => setForm((f) => ({ ...f, [k]: v }));
  const fe = (f: string) => (save.error instanceof ApiError ? save.error.fieldError(f) : undefined);
  const submit = (e: FormEvent) => { e.preventDefault(); save.mutate(); };
  const captionLimit = form.platform === 'INSTAGRAM' ? 2200 : form.platform === 'TIKTOK' ? 4000 : 5000;

  return (
    <form onSubmit={submit} className="space-y-4">
      {draft && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="label">Stage</span>
          {(['SCRIPT', 'IN_PRODUCTION', 'READY'] as DraftStage[]).map((s) => (
            <Button key={s} size="sm" variant={draft.stage === s ? 'primary' : 'secondary'} aria-pressed={draft.stage === s} onClick={() => stage.mutate(s)} disabled={stage.isPending}>{DRAFT_STAGE_LABEL[s]}</Button>
          ))}
          {draft.stage === 'PUBLISHED' && <Badge tone="accent" icon={<CheckCircle2 />}>Published</Badge>}
          {draft.parentTitle && <span className="text-2xs text-fg-3">Variant of “{draft.parentTitle}”</span>}
          <Menu label="Draft actions" trigger={<Button size="sm" variant="ghost" className="ml-auto"><MoreHorizontal /> More</Button>} items={[
            { label: 'Repurpose for other platforms', icon: <Copy />, onSelect: () => setRepurposeOpen(true) },
            'separator',
            { label: 'Delete draft', icon: <Trash2 />, destructive: true, onSelect: () => setConfirmDelete(true) },
          ]} />
        </div>
      )}
      {save.error && !(save.error instanceof ApiError && save.error.fieldErrors.length) ? <Alert tone="danger">{errorMessage(save.error)}</Alert> : null}
      <FormField label="Title" required error={fe('title')}>{(p) => <Input {...p} autoFocus={!draft} required maxLength={200} value={form.title} onChange={(e) => set('title', e.target.value)} />}</FormField>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <FormField label="Platform">{(p) => <Select {...p} value={form.platform} onChange={(e) => set('platform', e.target.value as Provider)}>{PROVIDERS.map((x) => <option key={x} value={x}>{PROVIDER_LABEL[x]}</option>)}</Select>}</FormField>
        <FormField label="Format">{(p) => <Select {...p} value={form.contentType} onChange={(e) => set('contentType', e.target.value as ContentType)}>{CONTENT_TYPES.map((x) => <option key={x} value={x}>{CONTENT_TYPE_LABEL[x]}</option>)}</Select>}</FormField>
        <FormField label="Planned date">{(p) => <Input {...p} type="date" value={form.plannedDate ?? ''} onChange={(e) => set('plannedDate', e.target.value || null)} />}</FormField>
      </div>
      <FormField label="Caption" hint={`${(form.caption ?? '').length} / ${captionLimit} characters`} error={(form.caption ?? '').length > captionLimit ? `Longer than ${PROVIDER_LABEL[form.platform]} allows` : undefined}>
        {(p) => <Textarea {...p} rows={4} value={form.caption ?? ''} onChange={(e) => set('caption', e.target.value)} />}
      </FormField>
      <FormField label="Script / outline">{(p) => <Textarea {...p} rows={6} value={form.script ?? ''} onChange={(e) => set('script', e.target.value)} className="font-mono text-xs" />}</FormField>
      <FormField label="Hashtags" hint="Separate with spaces or commas">{(p) => <Input {...p} value={hashtags} onChange={(e) => setHashtags(e.target.value)} placeholder="#gardening #smallspace" />}</FormField>
      <FormField label="Notes">{(p) => <Textarea {...p} rows={2} value={form.notes ?? ''} onChange={(e) => set('notes', e.target.value)} />}</FormField>
      <div className="grid grid-cols-2 gap-3">
        <FormField label="Linked goal">{(p) => (
          <Select {...p} value={form.goalId ?? ''} onChange={(e) => set('goalId', e.target.value || null)}>
            <option value="">None</option>
            {(goals.data ?? []).map((g) => <option key={g.id} value={g.id}>{g.title}</option>)}
            {draft?.goalId && !goals.data?.some((g) => g.id === draft.goalId) && <option value={draft.goalId}>{draft.goalTitle}</option>}
          </Select>
        )}</FormField>
        <FormField label="Linked campaign">{(p) => (
          <Select {...p} value={form.campaignId ?? ''} onChange={(e) => set('campaignId', e.target.value || null)}>
            <option value="">None</option>
            {(campaigns.data ?? []).filter((c) => c.stage !== 'ARCHIVED').map((c) => <option key={c.id} value={c.id}>{c.brandName} · {c.name}</option>)}
          </Select>
        )}</FormField>
      </div>
      {draft && <FormField label="Change note" hint="Optional — shown in version history">{(p) => <Input {...p} maxLength={300} value={form.changeSummary ?? ''} onChange={(e) => set('changeSummary', e.target.value)} />}</FormField>}
      <div className="flex justify-end gap-2 border-t border-border pt-3">
        <Button variant="ghost" onClick={onCancel}>Close</Button>
        <Button variant="primary" type="submit" loading={save.isPending}>{draft ? 'Save' : 'Create draft'}</Button>
      </div>
      {draft && <RepurposeDialog draft={draft} open={repurposeOpen} onOpenChange={setRepurposeOpen} />}
      <ConfirmDialog open={confirmDelete} onOpenChange={setConfirmDelete} title="Delete this draft?" description="Its version history is deleted too. Variants made from it are kept." confirmLabel="Delete draft" loading={remove.isPending} onConfirm={() => remove.mutate()} />
    </form>
  );
}

function RepurposeDialog({ draft, open, onOpenChange }: { draft: Draft; open: boolean; onOpenChange: (o: boolean) => void }) {
  const toast = useToast();
  const invalidate = useInvalidate();
  const defaults: Record<Provider, ContentType> = { INSTAGRAM: 'REEL', YOUTUBE: 'SHORT', TIKTOK: 'VIDEO' };
  const [chosen, setChosen] = useState<Record<Provider, ContentType | null>>({ INSTAGRAM: null, YOUTUBE: null, TIKTOK: null });
  const variants = (Object.entries(chosen) as [Provider, ContentType | null][]).filter(([, t]) => t).map(([platform, contentType]) => ({ platform, contentType: contentType! }));
  const run = useMutation({
    mutationFn: () => contentApi.repurpose(draft.id, variants),
    onSuccess: async (created) => { await invalidate(); toast.success(`${created.length} variant${created.length > 1 ? 's' : ''} created in Script`); onOpenChange(false); },
  });
  return (
    <Modal open={open} onOpenChange={onOpenChange} title="Repurpose draft" description="Creates platform-specific copies at the Script stage, linked to this draft. Text is copied — adapt it per platform."
      footer={<><Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button><Button variant="primary" disabled={variants.length === 0} loading={run.isPending} onClick={() => run.mutate()}>Create {variants.length || ''} variant{variants.length === 1 ? '' : 's'}</Button></>}>
      <div className="space-y-3">
        {run.error ? <Alert tone="danger">{errorMessage(run.error)}</Alert> : null}
        {PROVIDERS.map((p) => (
          <div key={p} className="flex items-center gap-3">
            <Checkbox label={PROVIDER_LABEL[p]} checked={Boolean(chosen[p])} onChange={(e) => setChosen((c) => ({ ...c, [p]: e.target.checked ? defaults[p] : null }))} className="w-32" />
            <Select aria-label={`${PROVIDER_LABEL[p]} format`} disabled={!chosen[p]} value={chosen[p] ?? defaults[p]} onChange={(e) => setChosen((c) => ({ ...c, [p]: e.target.value as ContentType }))} className="w-40">
              {CONTENT_TYPES.map((t) => <option key={t} value={t}>{CONTENT_TYPE_LABEL[t]}</option>)}
            </Select>
          </div>
        ))}
      </div>
    </Modal>
  );
}

/** Bloom never publishes. A draft is "published" only when the owner records it or links a post Bloom synced. */
function PublicationPanel({ draft }: { draft: Draft }) {
  const toast = useToast();
  const invalidate = useInvalidate();
  const [when, setWhen] = useState(`${todayLocal()}T12:00`);
  const [url, setUrl] = useState('');
  const range = { from: shiftDate(todayLocal(), -60), to: todayLocal() };
  const posts = useQuery({ queryKey: qk.posts({ ...range, provider: draft.platform, size: 30 }), queryFn: () => analyticsApi.posts({ ...range, provider: draft.platform, size: 30 }) });
  const record = useMutation({
    mutationFn: () => contentApi.recordPublication(draft.id, new Date(when).toISOString(), url || undefined),
    onSuccess: async () => { await invalidate(); toast.success('Recorded as published'); },
  });
  const link = useMutation({
    mutationFn: (postId: string) => contentApi.linkPost(draft.id, postId),
    onSuccess: async () => { await invalidate(); toast.success('Linked to the synced post — publication verified'); },
  });
  const clear = useMutation({
    mutationFn: () => contentApi.clearPublication(draft.id),
    onSuccess: async () => { await invalidate(); toast.success('Publication removed; draft moved back to Ready'); },
  });

  if (draft.stage === 'PUBLISHED') {
    return (
      <div className="space-y-3">
        <Alert tone="accent" title={draft.publicationSource === 'VERIFIED_API' ? 'Published — verified from a synced post' : 'Published — recorded manually'}>
          {formatInstant(draft.publishedAt, "EEEE d MMMM yyyy 'at' HH:mm")}
          {draft.publishedUrl && <> · <a className="underline" href={draft.publishedUrl} target="_blank" rel="noreferrer">View post</a></>}
        </Alert>
        <Button onClick={() => clear.mutate()} loading={clear.isPending}><Undo2 /> Remove publication record</Button>
      </div>
    );
  }
  return (
    <div className="space-y-5">
      <p className="text-sm text-fg-2">Bloom doesn't post for you. After you publish on {PROVIDER_LABEL[draft.platform]}, record it here.</p>
      <section className="space-y-2">
        <h3 className="label">Link a synced post (verified)</h3>
        {posts.isLoading ? <PanelSkeleton rows={2} /> : (posts.data?.items.length ?? 0) === 0 ? (
          <p className="text-sm text-fg-2">No {PROVIDER_LABEL[draft.platform]} posts synced in the last 60 days.</p>
        ) : (
          <ul className="max-h-56 divide-y divide-border overflow-y-auto rounded-md border border-border">
            {posts.data!.items.map((p) => (
              <li key={p.id} className="flex items-center gap-2 px-3 py-2 text-sm">
                <PlatformBadge provider={p.provider} compact />
                <span className="min-w-0 flex-1 truncate">{p.title ?? 'Untitled'}</span>
                <span className="text-2xs text-fg-3">{formatInstant(p.publishedAt, 'd MMM')}</span>
                <Button size="sm" onClick={() => link.mutate(p.id)} loading={link.isPending && link.variables === p.id}><Link2 /> Link</Button>
              </li>
            ))}
          </ul>
        )}
        {link.error ? <p className="text-xs text-danger">{errorMessage(link.error)}</p> : null}
      </section>
      <section className="space-y-2">
        <h3 className="label">Or record it manually</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <FormField label="Published at">{(p) => <Input {...p} type="datetime-local" value={when} max={`${todayLocal()}T23:59`} onChange={(e) => setWhen(e.target.value)} />}</FormField>
          <FormField label="Post URL" hint="Optional">{(p) => <Input {...p} type="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://" />}</FormField>
        </div>
        {record.error ? <Alert tone="danger">{errorMessage(record.error)}</Alert> : null}
        <Button variant="primary" onClick={() => record.mutate()} loading={record.isPending} disabled={!when}><CheckCircle2 /> Record as published</Button>
      </section>
    </div>
  );
}

function VersionsPanel({ draft }: { draft: Draft }) {
  const toast = useToast();
  const invalidate = useInvalidate();
  const versions = useQuery({ queryKey: qk.versions(draft.id), queryFn: () => contentApi.versions(draft.id) });
  const [preview, setPreview] = useState<number | null>(null);
  const restore = useMutation({
    mutationFn: (n: number) => contentApi.restoreVersion(draft.id, n),
    onSuccess: async (d) => { await invalidate(); toast.success(`Restored — saved as version ${d.currentVersion}`); },
    onError: (e) => toast.error(errorMessage(e)),
  });
  if (versions.isLoading) return <PanelSkeleton rows={3} />;
  if (versions.error) return <ErrorState error={versions.error} onRetry={() => versions.refetch()} />;
  return (
    <ol className="space-y-2">
      {versions.data!.map((v) => (
        <li key={v.id} className="rounded-md border border-border">
          <div className="flex items-center gap-2 px-3 py-2">
            <History className="h-4 w-4 text-fg-3" aria-hidden />
            <span className="text-sm font-medium">Version {v.versionNumber}</span>
            {v.versionNumber === draft.currentVersion && <Badge tone="accent">Current</Badge>}
            <span className="flex-1 truncate text-xs text-fg-2">{v.changeSummary}</span>
            <span className="text-2xs text-fg-3">{formatInstant(v.createdAt, 'd MMM, HH:mm')}</span>
            <Button size="sm" variant="ghost" aria-expanded={preview === v.versionNumber} onClick={() => setPreview(preview === v.versionNumber ? null : v.versionNumber)}>{preview === v.versionNumber ? 'Hide' : 'View'}</Button>
            {v.versionNumber !== draft.currentVersion && <Button size="sm" onClick={() => restore.mutate(v.versionNumber)} loading={restore.isPending && restore.variables === v.versionNumber}><RotateCcw /> Restore</Button>}
          </div>
          {preview === v.versionNumber && (
            <dl className="space-y-1 border-t border-border bg-surface-2/50 px-3 py-2 text-xs">
              <dt className="label">Title</dt><dd>{v.snapshot.title}</dd>
              {v.snapshot.caption && (<><dt className="label">Caption</dt><dd className="whitespace-pre-wrap">{v.snapshot.caption}</dd></>)}
              {v.snapshot.script && (<><dt className="label">Script</dt><dd className="whitespace-pre-wrap font-mono">{v.snapshot.script}</dd></>)}
              {v.snapshot.hashtags.length > 0 && (<><dt className="label">Hashtags</dt><dd>{v.snapshot.hashtags.map((h) => `#${h}`).join(' ')}</dd></>)}
            </dl>
          )}
        </li>
      ))}
    </ol>
  );
}
