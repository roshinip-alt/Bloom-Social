import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertCircle, Check, Loader2, Plus } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { TaskRow } from '@/components/data/TaskRow';
import { Button } from '@/components/ui/Button';
import { Alert, ErrorState, PanelSkeleton, errorMessage } from '@/components/ui/Feedback';
import { Input, Textarea } from '@/components/ui/FormControls';
import { useAutosave } from '@/hooks/useAutosave';
import { ApiError } from '@/services/apiClient';
import { planlyApi } from '@/services/bloomApi';
import type { Task } from '@/types/api';
import { formatDayLong, relativeTime } from '@/utils/dates';
import { qk } from '@/utils/queryKeys';

/** One day: focus, tasks and free-form notes that autosave with conflict detection. */
export function DayPanel({ date, onOpenTask, onCreate, onToggle }: { date: string; onOpenTask: (t: Task) => void; onCreate: (date: string) => void; onToggle: (t: Task) => unknown }) {
  const query = useQuery({ queryKey: qk.day(date), queryFn: () => planlyApi.day(date) });
  if (query.isLoading) return <PanelSkeleton rows={5} />;
  if (query.error || !query.data) return <div className="panel"><ErrorState error={query.error} onRetry={() => query.refetch()} /></div>;
  const day = query.data;
  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
      <section className="panel p-4">
        <h3 className="text-sm font-semibold">{formatDayLong(date)}{day.today && <span className="ml-2 text-xs font-normal text-accent">Today</span>}</h3>
        <FocusField key={date} date={date} initial={day.plan.focus ?? ''} />
        <div className="mt-4 flex items-center justify-between">
          <h4 className="label">Tasks</h4>
          <Button size="sm" variant="ghost" onClick={() => onCreate(date)}><Plus /> Add task</Button>
        </div>
        {day.tasks.length === 0 ? (
          <p className="py-4 text-sm text-fg-2">Nothing scheduled. Add a task or drag your plan into place.</p>
        ) : (
          <div className="divide-y divide-border">{day.tasks.map((t) => <TaskRow key={t.id} task={t} showDate={false} onOpen={onOpenTask} onToggle={onToggle} />)}</div>
        )}
      </section>
      <NotesEditor key={date} date={date} initialBody={day.note.body} initialVersion={day.note.version} updatedAt={day.note.updatedAt} />
    </div>
  );
}

function FocusField({ date, initial }: { date: string; initial: string }) {
  const client = useQueryClient();
  const [value, setValue] = useState(initial);
  const save = useMutation({
    mutationFn: (focus: string) => planlyApi.savePlan(date, focus),
    onSuccess: () => client.invalidateQueries({ queryKey: ['planly', 'calendar'] }),
  });
  const commit = () => {
    if (value.trim() !== initial.trim()) save.mutate(value);
  };
  return (
    <div className="mt-3">
      <label htmlFor={`focus-${date}`} className="label">Daily focus</label>
      <Input id={`focus-${date}`} className="mt-1" value={value} maxLength={300} placeholder="What would make today a good day?"
        onChange={(e) => setValue(e.target.value)} onBlur={commit} onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }} />
      <p className="mt-1 h-4 text-2xs text-fg-3" aria-live="polite">
        {save.isPending ? 'Saving…' : save.error ? <span className="text-danger">{errorMessage(save.error)}</span> : save.isSuccess ? 'Saved' : ''}
      </p>
    </div>
  );
}

function NotesEditor({ date, initialBody, initialVersion, updatedAt }: { date: string; initialBody: string; initialVersion: number; updatedAt: string | null }) {
  const client = useQueryClient();
  const [body, setBody] = useState(initialBody);
  const version = useRef(initialVersion);
  const [savedAt, setSavedAt] = useState(updatedAt);
  const { state, error, retry } = useAutosave(body, async (text) => {
    const saved = await planlyApi.saveNote(date, text, version.current);
    version.current = saved.version;
    setSavedAt(saved.updatedAt);
    void client.invalidateQueries({ queryKey: ['planly', 'calendar'] });
  });
  const conflict = error instanceof ApiError && error.code === 'STALE_VERSION';

  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (state === 'saving' || body !== initialBody && state !== 'saved') e.preventDefault();
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [state, body, initialBody]);

  return (
    <section className="panel flex flex-col p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold"><label htmlFor={`notes-${date}`}>Notes</label></h3>
        <SaveIndicator state={state} savedAt={savedAt} />
      </div>
      {state === 'error' && (
        conflict ? (
          <Alert tone="warning" className="mt-2" title="These notes changed in another tab"
            action={<Button size="sm" onClick={() => client.invalidateQueries({ queryKey: qk.day(date) })}>Load latest</Button>}>
            Your latest edit wasn't saved to avoid overwriting newer text. Copy it if needed, then load the latest version.
          </Alert>
        ) : (
          <Alert tone="danger" className="mt-2" title="Couldn't save notes" action={<Button size="sm" onClick={() => void retry()}>Retry</Button>}>
            {errorMessage(error)}
          </Alert>
        )
      )}
      <Textarea id={`notes-${date}`} value={body} onChange={(e) => setBody(e.target.value)} placeholder="Ideas, call notes, reflections…" className="mt-2 min-h-[260px] flex-1" />
    </section>
  );
}

function SaveIndicator({ state, savedAt }: { state: string; savedAt: string | null }) {
  return (
    <span className="inline-flex items-center gap-1 text-2xs text-fg-3" aria-live="polite">
      {state === 'saving' && (<><Loader2 className="h-3 w-3 animate-spin" aria-hidden /> Saving…</>)}
      {state === 'saved' && (<><Check className="h-3 w-3 text-accent" aria-hidden /> Saved</>)}
      {state === 'error' && (<><AlertCircle className="h-3 w-3 text-danger" aria-hidden /> Not saved</>)}
      {state === 'idle' && (savedAt ? `Saved ${relativeTime(savedAt)}` : 'Autosaves as you type')}
    </span>
  );
}
