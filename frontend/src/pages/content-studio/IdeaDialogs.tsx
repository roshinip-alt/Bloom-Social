import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Dialog';
import { Alert, errorMessage } from '@/components/ui/Feedback';
import { FormField, Input, Select, Textarea } from '@/components/ui/FormControls';
import { useToast } from '@/hooks/useToast';
import { contentApi } from '@/services/bloomApi';
import type { ContentType, Draft, Idea, Provider } from '@/types/api';
import { PROVIDERS } from '@/types/api';
import { CONTENT_TYPES, CONTENT_TYPE_LABEL, PROVIDER_LABEL } from '@/utils/labels';

export function IdeaDialog({ open, onOpenChange, idea }: { open: boolean; onOpenChange: (o: boolean) => void; idea: Idea | null }) {
  const client = useQueryClient();
  const toast = useToast();
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [platform, setPlatform] = useState<Provider | ''>('');
  const [tags, setTags] = useState('');
  useEffect(() => {
    if (!open) return;
    setTitle(idea?.title ?? '');
    setNotes(idea?.notes ?? '');
    setPlatform(idea?.platform ?? '');
    setTags(idea?.tags.join(', ') ?? '');
  }, [open, idea]);
  const save = useMutation({
    mutationFn: () => {
      const body = { title, notes: notes || null, platform: platform || null, tags: tags.split(',').map((t) => t.trim()).filter(Boolean) };
      return idea ? contentApi.updateIdea(idea.id, body) : contentApi.createIdea(body);
    },
    onSuccess: async () => { await client.invalidateQueries({ queryKey: ['content'] }); toast.success(idea ? 'Idea updated' : 'Idea saved'); onOpenChange(false); },
  });
  return (
    <Modal open={open} onOpenChange={onOpenChange} title={idea ? 'Edit idea' : 'New idea'}
      footer={<><Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button><Button variant="primary" type="submit" form="idea-form" loading={save.isPending}>Save idea</Button></>}>
      <form id="idea-form" className="space-y-3" onSubmit={(e) => { e.preventDefault(); save.mutate(); }}>
        {save.error ? <Alert tone="danger">{errorMessage(save.error)}</Alert> : null}
        <FormField label="Idea" required>{(p) => <Input {...p} autoFocus required maxLength={200} value={title} onChange={(e) => setTitle(e.target.value)} />}</FormField>
        <FormField label="Notes">{(p) => <Textarea {...p} rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />}</FormField>
        <div className="grid grid-cols-2 gap-3">
          <FormField label="Platform">{(p) => <Select {...p} value={platform} onChange={(e) => setPlatform(e.target.value as Provider | '')}><option value="">Any</option>{PROVIDERS.map((x) => <option key={x} value={x}>{PROVIDER_LABEL[x]}</option>)}</Select>}</FormField>
          <FormField label="Tags" hint="Comma separated">{(p) => <Input {...p} value={tags} onChange={(e) => setTags(e.target.value)} />}</FormField>
        </div>
      </form>
    </Modal>
  );
}

export function PromoteDialog({ idea, onOpenChange, onPromoted }: { idea: Idea | null; onOpenChange: (o: boolean) => void; onPromoted: (d: Draft) => void }) {
  const client = useQueryClient();
  const [platform, setPlatform] = useState<Provider>('INSTAGRAM');
  const [type, setType] = useState<ContentType>('REEL');
  useEffect(() => { if (idea?.platform) setPlatform(idea.platform); }, [idea]);
  const promote = useMutation({
    mutationFn: () => contentApi.promote(idea!.id, platform, type),
    onSuccess: async (d) => { await client.invalidateQueries({ queryKey: ['content'] }); onOpenChange(false); onPromoted(d); },
  });
  return (
    <Modal open={Boolean(idea)} onOpenChange={onOpenChange} title="Develop idea into a draft" description={idea?.title} size="sm"
      footer={<><Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button><Button variant="primary" loading={promote.isPending} onClick={() => promote.mutate()}>Create draft</Button></>}>
      <div className="grid grid-cols-2 gap-3">
        {promote.error ? <Alert tone="danger" className="col-span-2">{errorMessage(promote.error)}</Alert> : null}
        <FormField label="Platform">{(p) => <Select {...p} value={platform} onChange={(e) => setPlatform(e.target.value as Provider)}>{PROVIDERS.map((x) => <option key={x} value={x}>{PROVIDER_LABEL[x]}</option>)}</Select>}</FormField>
        <FormField label="Format">{(p) => <Select {...p} value={type} onChange={(e) => setType(e.target.value as ContentType)}>{CONTENT_TYPES.map((x) => <option key={x} value={x}>{CONTENT_TYPE_LABEL[x]}</option>)}</Select>}</FormField>
      </div>
    </Modal>
  );
}
