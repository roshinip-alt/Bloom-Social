import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Archive, ArrowRight, Copy, Lightbulb, MoreHorizontal, Pencil, Plus, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { PlatformBadge } from '@/components/data/PlatformBadge';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { EmptyState, ErrorState, PanelSkeleton, errorMessage } from '@/components/ui/Feedback';
import { Select } from '@/components/ui/FormControls';
import { IconButton } from '@/components/ui/IconButton';
import { Menu } from '@/components/ui/Menu';
import { useToast } from '@/hooks/useToast';
import { useUrlState } from '@/hooks/useUrlState';
import { PageHeader } from '@/layouts/PageHeader';
import { contentApi } from '@/services/bloomApi';
import type { Draft, DraftStage, Idea, Provider } from '@/types/api';
import { PROVIDERS } from '@/types/api';
import { cn } from '@/utils/cn';
import { formatDay } from '@/utils/dates';
import { CONTENT_TYPE_LABEL, DRAFT_STAGES, DRAFT_STAGE_LABEL, PROVIDER_LABEL } from '@/utils/labels';
import { qk } from '@/utils/queryKeys';
import { DraftEditor } from './DraftEditor';
import { IdeaDialog, PromoteDialog } from './IdeaDialogs';

export default function ContentStudioPage() {
  const client = useQueryClient();
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const [platform, setPlatform] = useUrlState('platform', '');
  const [draftId, setDraftId] = useUrlState('draft', '');
  const [creating, setCreating] = useState(false);
  const [ideaDialog, setIdeaDialog] = useState<{ open: boolean; idea: Idea | null }>({ open: false, idea: null });
  const [promoting, setPromoting] = useState<Idea | null>(null);
  const pipeline = useQuery({ queryKey: qk.pipeline, queryFn: contentApi.pipeline });

  useEffect(() => {
    const n = params.get('new');
    if (n === 'idea') setIdeaDialog({ open: true, idea: null });
    if (n === 'draft') setCreating(true);
    if (n) setParams((p) => { const x = new URLSearchParams(p); x.delete('new'); return x; }, { replace: true });
  }, [params, setParams]);

  const invalidate = () => client.invalidateQueries({ queryKey: ['content'] });
  const move = useMutation({
    mutationFn: ({ id, stage }: { id: string; stage: DraftStage }) => contentApi.moveStage(id, stage),
    onSuccess: async (d) => { await invalidate(); toast.success(`“${d.title}” moved to ${DRAFT_STAGE_LABEL[d.stage]}`); },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const ideaAction = useMutation({
    mutationFn: async ({ id, kind }: { id: string; kind: 'archive' | 'delete' }): Promise<void> => {
      if (kind === 'archive') await contentApi.archiveIdea(id);
      else await contentApi.deleteIdea(id);
    },
    onSuccess: async (_r, v) => { await invalidate(); toast.success(v.kind === 'archive' ? 'Idea archived' : 'Idea deleted'); },
    onError: (e) => toast.error(errorMessage(e)),
  });

  const match = (p: Provider | null) => !platform || p === platform;
  const ideas = (pipeline.data?.ideas ?? []).filter((i) => match(i.platform));

  return (
    <>
      <PageHeader title="Content Studio" description="Ideas to published, with versions. Bloom never posts — you record what you publish."
        actions={<>
          <Select aria-label="Platform filter" value={platform} onChange={(e) => setPlatform(e.target.value)} className="w-40">
            <option value="">All platforms</option>
            {PROVIDERS.map((p) => <option key={p} value={p}>{PROVIDER_LABEL[p]}</option>)}
          </Select>
          <Button onClick={() => setIdeaDialog({ open: true, idea: null })}><Lightbulb /> New idea</Button>
          <Button variant="primary" onClick={() => setCreating(true)}><Plus /> New draft</Button>
        </>} />

      {pipeline.isLoading ? <PanelSkeleton rows={6} /> : pipeline.error ? <div className="panel"><ErrorState error={pipeline.error} onRetry={() => pipeline.refetch()} /></div> : (
        <div className="relative -mx-4 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0">
          <div className="grid min-w-[1040px] grid-cols-5 gap-3">
            <Column title="Ideas" count={ideas.length}>
              {ideas.length === 0 && <EmptyState icon={Lightbulb} title="Idea bank is empty" action={<Button size="sm" onClick={() => setIdeaDialog({ open: true, idea: null })}><Plus /> Add idea</Button>} className="py-6" />}
              {ideas.map((i) => (
                <article key={i.id} className="rounded-md border border-border bg-surface p-2.5">
                  <div className="flex items-start gap-1">
                    <p className="flex-1 text-sm">{i.title}</p>
                    <Menu label={`Actions for ${i.title}`} trigger={<IconButton size="sm" label="Idea actions" icon={<MoreHorizontal />} tooltip={false} />} items={[
                      { label: 'Develop into draft', icon: <ArrowRight />, onSelect: () => setPromoting(i) },
                      { label: 'Edit idea', icon: <Pencil />, onSelect: () => setIdeaDialog({ open: true, idea: i }) },
                      { label: 'Archive', icon: <Archive />, onSelect: () => ideaAction.mutate({ id: i.id, kind: 'archive' }) },
                      'separator',
                      { label: 'Delete', icon: <Trash2 />, destructive: true, onSelect: () => ideaAction.mutate({ id: i.id, kind: 'delete' }) },
                    ]} />
                  </div>
                  {i.notes && <p className="mt-1 line-clamp-2 text-xs text-fg-2">{i.notes}</p>}
                  <div className="mt-2 flex flex-wrap items-center gap-1">
                    {i.platform && <PlatformBadge provider={i.platform} compact />}
                    {i.tags.map((t) => <Badge key={t}>{t}</Badge>)}
                    <Button size="sm" variant="ghost" className="ml-auto" onClick={() => setPromoting(i)}>Develop <ArrowRight /></Button>
                  </div>
                </article>
              ))}
            </Column>
            {DRAFT_STAGES.map((stage) => {
              const drafts = (pipeline.data!.stages[stage] ?? []).filter((d) => match(d.platform));
              return (
                <Column key={stage} title={DRAFT_STAGE_LABEL[stage]} count={drafts.length}>
                  {drafts.length === 0 && <p className="px-1 py-4 text-center text-xs text-fg-3">{stage === 'PUBLISHED' ? 'Record a publication from a Ready draft' : 'Empty'}</p>}
                  {drafts.map((d) => <DraftCard key={d.id} draft={d} onOpen={() => setDraftId(d.id)} onMove={(s) => move.mutate({ id: d.id, stage: s })} />)}
                </Column>
              );
            })}
          </div>
        </div>
      )}

      <DraftEditor draftId={draftId || null} creating={creating} onClose={() => { setCreating(false); setDraftId(null); }} onCreated={(d) => { setCreating(false); setDraftId(d.id); }} />
      <IdeaDialog open={ideaDialog.open} idea={ideaDialog.idea} onOpenChange={(open) => setIdeaDialog((s) => ({ ...s, open }))} />
      <PromoteDialog idea={promoting} onOpenChange={(o) => !o && setPromoting(null)} onPromoted={(d) => setDraftId(d.id)} />
    </>
  );
}

function Column({ title, count, children }: { title: string; count: number; children: React.ReactNode }) {
  return (
    <section className="flex min-h-[320px] flex-col rounded-lg border border-border bg-surface-2/50" aria-label={title}>
      <header className="flex items-center justify-between px-3 py-2">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-fg-2">{title}</h3>
        <span className="tabular text-2xs text-fg-3">{count}</span>
      </header>
      <div className="flex flex-1 flex-col gap-2 px-2 pb-2">{children}</div>
    </section>
  );
}

function DraftCard({ draft: d, onOpen, onMove }: { draft: Draft; onOpen: () => void; onMove: (s: DraftStage) => void }) {
  const idx = DRAFT_STAGES.indexOf(d.stage);
  const next = idx >= 0 && idx < 2 ? DRAFT_STAGES[idx + 1] : null;
  return (
    <article className={cn('rounded-md border border-border bg-surface p-2.5 transition-colors hover:border-border-strong')}>
      <div className="flex items-start gap-1">
        <button type="button" onClick={onOpen} className="flex-1 text-left text-sm font-medium hover:underline">{d.title}</button>
        {d.stage !== 'PUBLISHED' && (
          <Menu label={`Move ${d.title}`} trigger={<IconButton size="sm" label="Draft actions" icon={<MoreHorizontal />} tooltip={false} />} items={[
            { label: 'Open draft', icon: <Pencil />, onSelect: onOpen },
            ...(['SCRIPT', 'IN_PRODUCTION', 'READY'] as DraftStage[]).filter((s) => s !== d.stage).map((s) => ({ label: `Move to ${DRAFT_STAGE_LABEL[s]}`, icon: <ArrowRight />, onSelect: () => onMove(s) })),
          ]} />
        )}
      </div>
      <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-2xs text-fg-2">
        <PlatformBadge provider={d.platform} compact />
        <span>{CONTENT_TYPE_LABEL[d.contentType]}</span>
        {d.plannedDate && d.stage !== 'PUBLISHED' && <span>· {formatDay(d.plannedDate, 'd MMM')}</span>}
        {d.stage === 'PUBLISHED' && d.publishedAt && <span>· {d.publicationSource === 'VERIFIED_API' ? 'Verified' : 'Recorded'} {formatDay(d.publishedAt.slice(0, 10), 'd MMM')}</span>}
      </div>
      <div className="mt-1.5 flex flex-wrap gap-1">
        {d.campaignName && <Badge tone="info">{d.campaignName}</Badge>}
        {d.goalTitle && <Badge tone="outline">{d.goalTitle}</Badge>}
        {d.variantCount > 0 && <Badge icon={<Copy />}>{d.variantCount} variant{d.variantCount > 1 ? 's' : ''}</Badge>}
      </div>
      {next && <Button size="sm" variant="ghost" className="mt-1 w-full justify-between" onClick={() => onMove(next)}>Move to {DRAFT_STAGE_LABEL[next]} <ArrowRight /></Button>}
      {d.stage === 'READY' && <Button size="sm" variant="ghost" className="mt-1 w-full justify-between" onClick={onOpen}>Record publication <ArrowRight /></Button>}
    </article>
  );
}
