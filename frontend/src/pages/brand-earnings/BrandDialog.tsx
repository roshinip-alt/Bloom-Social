import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Dialog';
import { Alert, errorMessage } from '@/components/ui/Feedback';
import { FormField, Input, Textarea } from '@/components/ui/FormControls';
import { useToast } from '@/hooks/useToast';
import { ApiError } from '@/services/apiClient';
import { brandApi } from '@/services/bloomApi';
import type { Brand, BrandInput } from '@/types/api';

export function BrandDialog({ open, onOpenChange, brand, onSaved }: { open: boolean; onOpenChange: (o: boolean) => void; brand: Brand | null; onSaved?: (b: Brand) => void }) {
  const client = useQueryClient();
  const toast = useToast();
  const [form, setForm] = useState<BrandInput>({ brandName: '' });
  useEffect(() => {
    if (open) setForm(brand ? { brandName: brand.brandName, contactName: brand.contactName, email: brand.email, phone: brand.phone, website: brand.website, notes: brand.notes } : { brandName: '' });
  }, [open, brand]);
  const save = useMutation({
    mutationFn: () => {
      const body = Object.fromEntries(Object.entries(form).map(([k, v]) => [k, v === '' ? null : v])) as BrandInput;
      return brand ? brandApi.updateBrand(brand.id, body) : brandApi.createBrand(body);
    },
    onSuccess: async (b) => { await client.invalidateQueries({ queryKey: ['brand'] }); toast.success(brand ? 'Brand updated' : 'Brand added'); onSaved?.(b); onOpenChange(false); },
  });
  const set = (k: keyof BrandInput, v: string) => setForm((f) => ({ ...f, [k]: v }));
  const fe = (f: string) => (save.error instanceof ApiError ? save.error.fieldError(f) : undefined);
  return (
    <Modal open={open} onOpenChange={onOpenChange} title={brand ? 'Edit brand' : 'New brand'}
      footer={<><Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button><Button variant="primary" type="submit" form="brand-form" loading={save.isPending}>Save brand</Button></>}>
      <form id="brand-form" className="grid gap-3 sm:grid-cols-2" onSubmit={(e) => { e.preventDefault(); save.mutate(); }}>
        {save.error && !(save.error instanceof ApiError && save.error.fieldErrors.length) ? <Alert tone="danger" className="sm:col-span-2">{errorMessage(save.error)}</Alert> : null}
        <FormField label="Brand" required error={fe('brandName')} className="sm:col-span-2">{(p) => <Input {...p} autoFocus required maxLength={160} value={form.brandName} onChange={(e) => set('brandName', e.target.value)} />}</FormField>
        <FormField label="Contact name">{(p) => <Input {...p} value={form.contactName ?? ''} onChange={(e) => set('contactName', e.target.value)} />}</FormField>
        <FormField label="Email" error={fe('email')}>{(p) => <Input {...p} type="email" value={form.email ?? ''} onChange={(e) => set('email', e.target.value)} />}</FormField>
        <FormField label="Phone">{(p) => <Input {...p} type="tel" value={form.phone ?? ''} onChange={(e) => set('phone', e.target.value)} />}</FormField>
        <FormField label="Website">{(p) => <Input {...p} type="url" placeholder="https://" value={form.website ?? ''} onChange={(e) => set('website', e.target.value)} />}</FormField>
        <FormField label="Notes" className="sm:col-span-2">{(p) => <Textarea {...p} rows={3} value={form.notes ?? ''} onChange={(e) => set('notes', e.target.value)} />}</FormField>
      </form>
    </Modal>
  );
}
