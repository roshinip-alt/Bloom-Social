import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { workspaceApi } from '@/services/bloomApi';
import { workspaceStore } from '@/services/workspaceStore';
import type { Workspace } from '@/types/api';
import { qk } from '@/utils/queryKeys';

interface WorkspaceContextValue {
  workspaces: Workspace[];
  current: Workspace | null;
  isLoading: boolean;
  error: unknown;
  select: (id: string) => void;
}

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

/**
 * Local workspace selection (demo vs personal). Not authentication: the backend resolves the workspace from the
 * header this sets. Switching clears every cached query so no data leaks between workspaces.
 */
export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const client = useQueryClient();
  const [selected, setSelected] = useState<string | null>(workspaceStore.get());
  const { data, isLoading, error } = useQuery({ queryKey: qk.workspaces, queryFn: workspaceApi.list });

  const workspaces = useMemo(() => data ?? [], [data]);
  const current = workspaces.find((w) => w.id === selected) ?? workspaces[0] ?? null;

  useEffect(() => {
    // Heal a stale selection (e.g. a removed workspace) by falling back to the default.
    if (current && current.id !== workspaceStore.get()) {
      workspaceStore.set(current.id);
      setSelected(current.id);
    }
  }, [current]);

  const select = useCallback(
    (id: string) => {
      if (id === workspaceStore.get()) return;
      workspaceStore.set(id);
      setSelected(id);
      client.removeQueries({ predicate: (q) => q.queryKey[0] !== 'workspaces' });
    },
    [client],
  );

  const value = useMemo(() => ({ workspaces, current, isLoading, error, select }), [workspaces, current, isLoading, error, select]);
  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

export function useWorkspace(): WorkspaceContextValue {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) throw new Error('useWorkspace must be used inside WorkspaceProvider');
  return ctx;
}
