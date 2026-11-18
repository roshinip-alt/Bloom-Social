import { useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { ErrorState, PanelSkeleton } from '@/components/ui/Feedback';
import { useWorkspace } from '@/hooks/useWorkspace';
import { CommandPalette } from './CommandPalette';
import { Topbar } from './Topbar';

/** Top navigation + centred content. The sidebar is gone; navigation lives in hover dropdowns in the top bar. */
export function AppShell() {
  const { pathname } = useLocation();
  const { current, isLoading, error } = useWorkspace();
  const [commandOpen, setCommandOpen] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setCommandOpen((o) => !o);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div className="min-h-dvh">
      <a href="#main" className="sr-only z-50 rounded-full bg-surface px-4 py-2 focus:not-sr-only focus:fixed focus:left-2 focus:top-2">
        Skip to content
      </a>
      <Topbar onOpenCommand={() => setCommandOpen(true)} />
      <main id="main" className="mx-auto w-full max-w-[1240px] px-4 py-8 sm:px-6 lg:px-8">
        {isLoading ? (
          <PanelSkeleton rows={6} />
        ) : error || !current ? (
          <div className="panel"><ErrorState error={error} title="Bloom could not load your workspace" onRetry={() => window.location.reload()} /></div>
        ) : (
          <div key={pathname} className="page-in"><Outlet /></div>
        )}
      </main>
      <CommandPalette open={commandOpen} onOpenChange={setCommandOpen} />
    </div>
  );
}
