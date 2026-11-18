import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { lazy, Suspense } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { PanelSkeleton } from './components/ui/Feedback';
import { TooltipProvider } from './components/ui/Tooltip';
import { ToastProvider } from './hooks/useToast';
import { WorkspaceProvider } from './hooks/useWorkspace';
import { AppShell } from './layouts/AppShell';
import { ApiError } from './services/apiClient';

const DashboardPage = lazy(() => import('./pages/dashboard/DashboardPage'));
const PlanlyPage = lazy(() => import('./pages/planly/PlanlyPage'));
const GoalsPage = lazy(() => import('./pages/goals/GoalsPage'));
const AnalyticsPage = lazy(() => import('./pages/analytics/AnalyticsPage'));
const ContentStudioPage = lazy(() => import('./pages/content-studio/ContentStudioPage'));
const AudiencePage = lazy(() => import('./pages/audience/AudiencePage'));
const BrandEarningsPage = lazy(() => import('./pages/brand-earnings/BrandEarningsPage'));
const SettingsPage = lazy(() => import('./pages/settings/SettingsPage'));
const ConnectedAccountsPage = lazy(() => import('./pages/settings/ConnectedAccountsPage'));
const NotFoundPage = lazy(() => import('./pages/NotFoundPage'));

export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        refetchOnWindowFocus: false,
        // Client errors (4xx) will not fix themselves; only retry network/server failures.
        retry: (count, error) => count < 2 && !(error instanceof ApiError && error.status >= 400 && error.status < 500),
      },
    },
  });
}

const queryClient = createQueryClient();

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <ToastProvider>
          <WorkspaceProvider>
            <BrowserRouter>
              <Routes>
                <Route element={<AppShell />}>
                  {[
                    ['/', DashboardPage],
                    ['/planly', PlanlyPage],
                    ['/goals', GoalsPage],
                    ['/analytics', AnalyticsPage],
                    ['/content-studio', ContentStudioPage],
                    ['/audience', AudiencePage],
                    ['/brand-earnings', BrandEarningsPage],
                    ['/settings', SettingsPage],
                    ['/settings/connected-accounts', ConnectedAccountsPage],
                    ['*', NotFoundPage],
                  ].map(([path, Page]) => {
                    const P = Page as React.ComponentType;
                    return (
                      <Route
                        key={path as string}
                        path={path as string}
                        element={
                          <Suspense fallback={<PanelSkeleton rows={5} />}>
                            <P />
                          </Suspense>
                        }
                      />
                    );
                  })}
                </Route>
              </Routes>
            </BrowserRouter>
          </WorkspaceProvider>
        </ToastProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}
