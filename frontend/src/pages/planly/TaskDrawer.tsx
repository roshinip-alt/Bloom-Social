import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2 } from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog, Drawer } from '@/components/ui/Dialog';
import { Alert, errorMessage } from '@/components/ui/Feedback';
import { FormField, Input, Select, Textarea } from '@/components/ui/FormControls';
import { IconButton } from '@/components/ui/IconButton';
import { useToast } from '@/hooks/useToast';
import { ApiError } from '@/services/apiClient';
import { goalsApi, planlyApi } from '@/services/bloomApi';
import type { Recurrence, Subtask, Task, TaskInput, TaskPriority, TaskStatus } from '@/types/api';
import { formatDay, shiftDate } from '@/utils/dates';
import { PRIORITY_LABEL, RECURRENCE_LABEL, TASK_STATUS_LABEL } from '@/utils/labels';
import { qk } from '@/utils/queryKeys';

interface TaskDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task: Task | null;
  defaultDate?: string | null;
  today: string;
}

const emptyForm = (date?: string | null): TaskInput => ({
  title: '', description: '', dueDate: date ?? null, dueTime: null, priority: 'MEDIUM', status: 'TODO', recurrence: 'NONE', recurrenceUntil: null, goalId: null,
});

/** Create / edit a task, its subtasks, schedule and goal link. */
export function TaskDrawer({ open, onOpenChange, task, defaultDate, today }: TaskDrawerProps) {
  const client = useQueryClient();
  const toast = useToast();
  const [form, setForm] = useState<TaskInput>(emptyForm(defaultDate));
  const [subtasks, setSubtasks] = useState<Subtask[]>([]);
  const [newSubtask, setNewSubtask] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const goals = useQuery({ queryKey: qk.goals(['ACTIVE']), queryFn: () => goalsApi.list(['ACTIVE']), enabled: open });

  useEffect(() => {
    if (!open) return;
    if (task) {
      setForm({ title: task.title, description: task.description ?? '', dueDate: task.dueDate, dueTime: task.dueTime?.slice(0, 5) ?? null, priority: task.priority, status: task.status, recurrence: task.recurrence, recurrenceUntil: task.recurrenceUntil, goalId: task.goalId, contentDraftId: task.contentDraftId });
      setSubtasks(task.subtasks);
    } else {
      setForm(emptyForm(defaultDate));
      setSubtasks([]);
    }
    setNewSubtask('');
  }, [open, task, defaultDate]);

  const invalidate = () => client.invalidateQueries({ queryKey: ['planly'] }).then(() => client.invalidateQueries({ queryKey: ['dashboard'] }));

  const save = useMutation({
    mutationFn: async () => {
      const body = { ...form, description: form.description || null, dueTime: form.dueDate ? form.dueTime || null : null };
      const saved = task ? await planlyApi.updateTask(task.id, body) : await planlyApi.createTask(body);
      if (!task) {
        for (const s of subtasks) await planlyApi.addSubtask(saved.id, s.title);
      }
      return saved;
    },
    onSuccess: async () => {
      await invalidate();
      toast.success(task ? 'Task updated' : 'Task created');
      onOpenChange(false);
    },
  });

  const remove = useMutation({
    mutationFn: () => planlyApi.deleteTask(task!.id),
    onSuccess: async () => {
      await invalidate();
      toast.success('Task deleted');
      setConfirmDelete(false);
      onOpenChange(false);
    },
  });

  const subtaskMutation = useMutation({
    mutationFn: async (action: { type: 'add'; title: string } | { type: 'toggle'; s: Subtask } | { type: 'delete'; s: Subtask }) => {
      if (!task) return;
      if (action.type === 'add') return planlyApi.addSubtask(task.id, action.title);
      if (action.type === 'toggle') return planlyApi.updateSubtask(task.id, { ...action.s, done: !action.s.done });
      return planlyApi.deleteSubtask(task.id, action.s.id);
    },
    onSuccess: (result, action) => {
      if (action.type === 'add' && result) setSubtasks((s) => [...s, result as Subtask]);
      if (action.type === 'toggle') setSubtasks((s) => s.map((x) => (x.id === action.s.id ? { ...x, done: !x.done } : x)));
      if (action.type === 'delete') setSubtasks((s) => s.filter((x) => x.id !== action.s.id));
      void invalidate();
    },
  });

  const addSubtask = () => {
    const title = newSubtask.trim();
    if (!title) return;
    if (task) subtaskMutation.mutate({ type: 'add', title });
    else setSubtasks((s) => [...s, { id: `new-${s.length}`, title, done: false, position: s.length }]);
    setNewSubtask('');
  };

  const set = <K extends keyof TaskInput>(key: K, value: TaskInput[K]) => setForm((f) => ({ ...f, [key]: value }));
  const fieldError = (f: string) => (save.error instanceof ApiError ? save.error.fieldError(f) : undefined);
  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    save.mutate();
  };

  return (
    <Drawer
      open={open}
      onOpenChange={onOpenChange}
      title={task ? 'Edit task' : 'New task'}
      description={form.dueDate ? `Due ${formatDay(form.dueDate, 'EEEE d MMMM')}` : 'No due date'}
      footer={
        <>
          {task && (
            <Button variant="destructive-ghost" className="mr-auto" onClick={() => setConfirmDelete(true)}>
              <Trash2 /> Delete
            </Button>
          )}
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button variant="primary" type="submit" form="task-form" loading={save.isPending}>{task ? 'Save changes' : 'Create task'}</Button>
        </>
      }
    >
      <form id="task-form" onSubmit={onSubmit} className="space-y-4">
        {save.error && !(save.error instanceof ApiError && save.error.fieldErrors.length) ? <Alert tone="danger">{errorMessage(save.error)}</Alert> : null}
        <FormField label="Title" required error={fieldError('title')}>
          {(p) => <Input {...p} autoFocus value={form.title} onChange={(e) => set('title', e.target.value)} maxLength={200} required placeholder="What needs to happen?" />}
        </FormField>
        <FormField label="Notes">{(p) => <Textarea {...p} value={form.description ?? ''} onChange={(e) => set('description', e.target.value)} rows={3} />}</FormField>

        <div className="grid grid-cols-2 gap-3">
          <FormField label="Due date">{(p) => <Input {...p} type="date" value={form.dueDate ?? ''} onChange={(e) => set('dueDate', e.target.value || null)} />}</FormField>
          <FormField label="Time" hint={!form.dueDate ? 'Set a date first' : undefined}>
            {(p) => <Input {...p} type="time" disabled={!form.dueDate} value={form.dueTime ?? ''} onChange={(e) => set('dueTime', e.target.value || null)} />}
          </FormField>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {[
            ['Today', today],
            ['Tomorrow', shiftDate(today, 1)],
            ['Next week', shiftDate(today, 7)],
          ].map(([label, date]) => (
            <Button key={label} size="sm" variant="ghost" onClick={() => set('dueDate', date!)}>{label}</Button>
          ))}
          {form.dueDate && form.recurrence === 'NONE' && <Button size="sm" variant="ghost" onClick={() => set('dueDate', null)}>No date</Button>}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <FormField label="Priority">
            {(p) => (
              <Select {...p} value={form.priority} onChange={(e) => set('priority', e.target.value as TaskPriority)}>
                {(Object.keys(PRIORITY_LABEL) as TaskPriority[]).map((k) => <option key={k} value={k}>{PRIORITY_LABEL[k]}</option>)}
              </Select>
            )}
          </FormField>
          <FormField label="Status">
            {(p) => (
              <Select {...p} value={form.status} onChange={(e) => set('status', e.target.value as TaskStatus)}>
                {(Object.keys(TASK_STATUS_LABEL) as TaskStatus[]).map((k) => <option key={k} value={k}>{TASK_STATUS_LABEL[k]}</option>)}
              </Select>
            )}
          </FormField>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <FormField label="Repeats" error={fieldError('recurrence')} hint={form.recurrence !== 'NONE' ? 'Completing it schedules the next one' : undefined}>
            {(p) => (
              <Select {...p} value={form.recurrence} onChange={(e) => set('recurrence', e.target.value as Recurrence)}>
                {(Object.keys(RECURRENCE_LABEL) as Recurrence[]).map((k) => <option key={k} value={k} disabled={k !== 'NONE' && !form.dueDate}>{RECURRENCE_LABEL[k]}</option>)}
              </Select>
            )}
          </FormField>
          <FormField label="Repeat until">
            {(p) => <Input {...p} type="date" disabled={form.recurrence === 'NONE'} min={form.dueDate ?? undefined} value={form.recurrenceUntil ?? ''} onChange={(e) => set('recurrenceUntil', e.target.value || null)} />}
          </FormField>
        </div>

        <FormField label="Linked goal">
          {(p) => (
            <Select {...p} value={form.goalId ?? ''} onChange={(e) => set('goalId', e.target.value || null)}>
              <option value="">No goal</option>
              {(goals.data ?? []).map((g) => <option key={g.id} value={g.id}>{g.title}</option>)}
              {task?.goalId && !goals.data?.some((g) => g.id === task.goalId) && <option value={task.goalId}>{task.goalTitle ?? 'Linked goal'}</option>}
            </Select>
          )}
        </FormField>

        <fieldset className="space-y-2">
          <legend className="text-xs font-medium text-fg-2">Subtasks</legend>
          <ul className="space-y-1">
            {subtasks.map((s) => (
              <li key={s.id} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={s.done}
                  disabled={!task}
                  aria-label={`Subtask ${s.title} done`}
                  onChange={() => subtaskMutation.mutate({ type: 'toggle', s })}
                  className="h-4 w-4 accent-[rgb(var(--accent))]"
                />
                <span className={s.done ? 'flex-1 text-fg-3 line-through' : 'flex-1'}>{s.title}</span>
                <IconButton size="sm" label={`Remove subtask ${s.title}`} icon={<Trash2 />} onClick={() => (task ? subtaskMutation.mutate({ type: 'delete', s }) : setSubtasks((all) => all.filter((x) => x !== s)))} />
              </li>
            ))}
          </ul>
          <div className="flex gap-2">
            <Input value={newSubtask} onChange={(e) => setNewSubtask(e.target.value)} placeholder="Add a subtask" aria-label="New subtask"
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addSubtask(); } }} />
            <Button onClick={addSubtask} disabled={!newSubtask.trim()} loading={subtaskMutation.isPending}><Plus /> Add</Button>
          </div>
          {subtaskMutation.error ? <p className="text-xs text-danger">{errorMessage(subtaskMutation.error)}</p> : null}
        </fieldset>
      </form>
      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="Delete this task?"
        description={task?.recurrence !== 'NONE' ? 'Only this occurrence is deleted; earlier completed occurrences stay.' : 'The task and its subtasks are removed.'}
        confirmLabel="Delete task"
        loading={remove.isPending}
        onConfirm={() => remove.mutate()}
      />
    </Drawer>
  );
}
