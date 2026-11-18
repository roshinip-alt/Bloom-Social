import { useMutation, useQueryClient } from '@tanstack/react-query';
import { FlaskConical, Link2, RotateCcw } from 'lucide-react';
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/Dialog';
import { Alert, errorMessage } from '@/components/ui/Feedback';
import { FormField, Input, Select } from '@/components/ui/FormControls';
import { useToast } from '@/hooks/useToast';
import { useWorkspace } from '@/hooks/useWorkspace';
import { PageHeader } from '@/layouts/PageHeader';
import { ApiError } from '@/services/apiClient';
import { workspaceApi } from '@/services/bloomApi';

function timezones(): string[] {
  try {
    return (Intl as unknown as { supportedValuesOf: (k: string) => string[] }).supportedValuesOf('timeZone');
  } catch {
    return ['UTC', 'Europe/London', 'America/New_York', 'America/Los_Angeles', 'Asia/Kolkata', 'Asia/Tokyo', 'Australia/Sydney'];
  }
}

export default function SettingsPage() {
  const client = useQueryClient();
  const toast = useToast();
  const { current } = useWorkspace();
  const [name, setName] = useState('');
  const [timezone, setTimezone] = useState('UTC');
  const [currency, setCurrency] = useState('USD');
  const [confirmReset, setConfirmReset] = useState(false);
  const zones = useMemo(timezones, []);

  useEffect(() => {
    if (!current) return;
    setName(current.name);
    setTimezone(current.timezone);
    setCurrency(current.defaultCurrency);
  }, [current]);

  const save = useMutation({
    mutationFn: () => workspaceApi.update({ name, timezone, defaultCurrency: currency }),
    onSuccess: async () => {
      await client.invalidateQueries();
      toast.success('Workspace settings saved');
    },
  });
  const reset = useMutation({
    mutationFn: workspaceApi.resetDemo,
    onSuccess: async () => {
      setConfirmReset(false);
      await client.invalidateQueries();
      toast.success('Demo workspace rebuilt with fresh sample data');
    },
  });

  const fe = (f: string) => (save.error instanceof ApiError ? save.error.fieldError(f) : undefined);
  const submit = (e: FormEvent) => { e.preventDefault(); save.mutate(); };
  if (!current) return null;

  return (
    <>
      <PageHeader title="Settings" description="Workspace preferences. Bloom runs locally without sign-in in this version." />
      <div className="grid max-w-3xl gap-4">
        <section className="panel">
          <header className="border-b border-border px-5 py-3">
            <h3 className="text-sm font-semibold">Workspace</h3>
            <p className="text-xs text-fg-2">Calendar dates follow this timezone; new campaigns default to this currency.</p>
          </header>
          <form onSubmit={submit} className="grid gap-4 px-5 py-4 sm:grid-cols-2">
            {save.error && !(save.error instanceof ApiError && save.error.fieldErrors.length) ? <Alert tone="danger" className="sm:col-span-2">{errorMessage(save.error)}</Alert> : null}
            <FormField label="Name" required error={fe('name')} className="sm:col-span-2">{(p) => <Input {...p} required maxLength={120} value={name} onChange={(e) => setName(e.target.value)} />}</FormField>
            <FormField label="Timezone" error={fe('timezone')}>{(p) => (
              <Select {...p} value={timezone} onChange={(e) => setTimezone(e.target.value)}>
                {!zones.includes(timezone) && <option value={timezone}>{timezone}</option>}
                {zones.map((z) => <option key={z} value={z}>{z}</option>)}
              </Select>
            )}</FormField>
            <FormField label="Default currency" hint="ISO 4217, e.g. USD, EUR, GBP" error={fe('defaultCurrency')}>
              {(p) => <Input {...p} required maxLength={3} pattern="[A-Za-z]{3}" value={currency} onChange={(e) => setCurrency(e.target.value.toUpperCase())} />}
            </FormField>
            <div className="flex justify-end sm:col-span-2"><Button type="submit" variant="primary" loading={save.isPending}>Save changes</Button></div>
          </form>
        </section>

        <section className="panel px-5 py-4">
          <div className="flex flex-wrap items-center gap-3">
            <Link2 className="h-4 w-4 text-fg-2" aria-hidden />
            <div className="min-w-0 flex-1">
              <h3 className="text-sm font-semibold">Connected accounts</h3>
              <p className="text-xs text-fg-2">Instagram, YouTube and TikTok connections, permissions and sync.</p>
            </div>
            <Link to="/settings/connected-accounts" className="text-sm font-medium text-accent hover:underline">Manage</Link>
          </div>
        </section>

        {current.demo && (
          <section className="panel px-5 py-4">
            <div className="flex flex-wrap items-start gap-3">
              <FlaskConical className="mt-0.5 h-4 w-4 text-accent" aria-hidden />
              <div className="min-w-0 flex-1">
                <h3 className="text-sm font-semibold">Demo data</h3>
                <p className="text-xs text-fg-2">Rebuild this workspace's synthetic accounts, metrics, plans, goals, content and campaigns. Only the demo workspace is affected — “My workspace” and live connections are never touched.</p>
              </div>
              <Button variant="destructive-ghost" onClick={() => setConfirmReset(true)}><RotateCcw /> Reset demo data</Button>
            </div>
            {reset.error ? <Alert tone="danger" className="mt-3">{errorMessage(reset.error)}</Alert> : null}
          </section>
        )}
      </div>
      <ConfirmDialog open={confirmReset} onOpenChange={setConfirmReset} title="Reset the demo workspace?" description="Everything you changed in the demo workspace is replaced with fresh sample data."
        confirmLabel="Reset demo data" loading={reset.isPending} onConfirm={() => reset.mutate()} />
    </>
  );
}
