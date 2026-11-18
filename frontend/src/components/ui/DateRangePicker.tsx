import { CalendarRange } from 'lucide-react';
import { useState } from 'react';
import type { RangePreset } from '@/hooks/useDateRange';
import { formatDay } from '@/utils/dates';
import { Button } from './Button';
import { Modal } from './Dialog';
import { FormField, Input } from './FormControls';
import { Segmented } from './Tabs';

/** Preset ranges plus a custom range dialog. Shows the resolved dates so the period is never ambiguous. */
export function DateRangePicker({ preset, range, onPreset, onCustom }: {
  preset: RangePreset;
  range: { from: string; to: string };
  onPreset: (p: RangePreset) => void;
  onCustom: (from: string, to: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [from, setFrom] = useState(range.from);
  const [to, setTo] = useState(range.to);
  const invalid = !from || !to || from > to;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Segmented
        label="Date range"
        value={preset === 'custom' ? 'custom' : preset}
        onChange={(v) => (v === 'custom' ? (setFrom(range.from), setTo(range.to), setOpen(true)) : onPreset(v))}
        options={[
          { value: '7d', label: '7D' },
          { value: '28d', label: '28D' },
          { value: '90d', label: '90D' },
          { value: 'custom', label: 'Custom' },
        ]}
      />
      <span className="tabular inline-flex items-center gap-1 text-xs text-fg-2">
        <CalendarRange className="h-3.5 w-3.5" aria-hidden />
        {formatDay(range.from, 'd MMM yyyy')} – {formatDay(range.to, 'd MMM yyyy')}
      </span>
      <Modal
        open={open}
        onOpenChange={setOpen}
        title="Custom date range"
        description="Both dates are inclusive. Ranges are limited to two years."
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button variant="primary" disabled={invalid} onClick={() => { onCustom(from, to); setOpen(false); }}>Apply</Button>
          </>
        }
      >
        <div className="grid grid-cols-2 gap-3">
          <FormField label="From">{(p) => <Input type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} {...p} />}</FormField>
          <FormField label="To" error={from && to && from > to ? 'Must be after the start date' : undefined}>
            {(p) => <Input type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} {...p} />}
          </FormField>
        </div>
      </Modal>
    </div>
  );
}
