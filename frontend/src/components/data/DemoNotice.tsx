import { FlaskConical } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useWorkspace } from '@/hooks/useWorkspace';
import { Alert } from '../ui/Feedback';

/** Shown on every data screen of the demo workspace so synthetic data is never mistaken for real data. */
export function DemoNotice() {
  const { current } = useWorkspace();
  if (!current?.demo) return null;
  return (
    <Alert tone="accent" title="Demo workspace — synthetic sample data" className="items-center">
      Accounts, metrics and posts here are generated for illustration. To use real data,{' '}
      <Link to="/settings/connected-accounts" className="font-medium text-accent underline-offset-2 hover:underline">
        switch to My workspace and connect an account
      </Link>
      .
    </Alert>
  );
}

export function DemoBadge() {
  return (
    <span className="inline-flex h-5 items-center gap-1 rounded border border-accent/30 px-1.5 text-2xs font-medium text-accent">
      <FlaskConical className="h-3 w-3" aria-hidden /> Demo
    </span>
  );
}
