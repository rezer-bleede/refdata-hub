import { useCallback, useEffect, useMemo, useState } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';

import ConnectionsPage from './pages/ConnectionsPage';
import DashboardPage from './pages/DashboardPage';
import FieldMappingsPage from './pages/FieldMappingsPage';
import MappingHistoryPage from './pages/MappingHistoryPage';
import MatchInsightsPage from './pages/MatchInsightsPage';
import SuggestionsPage from './pages/SuggestionsPage';
import CanonicalLibraryPage from './pages/CanonicalLibraryPage';
import DimensionsPage from './pages/DimensionsPage';
import DimensionDetailPage from './pages/DimensionDetailPage';
import DimensionRelationsPage from './pages/DimensionRelationsPage';
import SettingsPage from './pages/SettingsPage';
import SourceConnectionDetailPage from './pages/SourceConnectionDetailPage';
import Sidebar from './components/layout/Sidebar';
import TopBar from './components/layout/TopBar';
import { navItems } from './components/layout/navigation';
import { AppStateProvider, useAppState } from './state/AppStateContext';
import { cn } from './utils/cn';
import {
  applyTheme,
  persistTheme,
  resolveInitialTheme,
  resolveTheme,
  type ThemeChoice,
} from './themes';
import type { ToastMessage } from './types';

export { navItems };

const SIDEBAR_STORAGE_KEY = 'refdata-hub:sidebar-collapsed';

interface AppScaffoldProps {
  themeChoice: ThemeChoice;
  onThemeChange: (choice: ThemeChoice) => void;
  toast: ToastMessage | null;
  toastKey: number;
  onToast: (toast: ToastMessage) => void;
  onCloseToast: () => void;
}

const pageSubtitles: Record<string, string> = {
  '/dashboard': 'Operationalise semantic standards with observability inspired by modern data catalogs.',
  '/dimensions': 'Browse and curate the reference dimensions harmonized across your programs.',
  '/canonical-library': 'The approved canonical values that raw source data maps into.',
  '/dimension-relations': 'Visualize how dimensions cross-reference each other.',
  '/connections': 'Manage source systems and explore their live schemas.',
  '/field-mappings': 'Connect source fields to canonical dimensions for matching.',
  '/match-insights': 'Understand semantic match quality and clustering across sources.',
  '/suggestions': 'Review raw values and route them to approved canonical records.',
  '/mapping-history': 'Trace every approved, overridden, and reverted value mapping.',
  '/settings': 'Tune matcher behavior, thresholds, and LLM integration.',
};

const AppScaffold = ({
  themeChoice,
  onThemeChange,
  toast,
  toastKey,
  onToast,
  onCloseToast,
}: AppScaffoldProps) => {
  const { config, isLoading, loadError, refresh } = useAppState();
  const location = useLocation();
  const navigate = useNavigate();

  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
    try {
      return window.localStorage.getItem(SIDEBAR_STORAGE_KEY) === 'true';
    } catch {
      return false;
    }
  });

  const { mode: resolvedMode } = useMemo(() => resolveTheme(themeChoice), [themeChoice]);

  const toggleSidebar = useCallback(() => {
    setIsSidebarCollapsed((collapsed) => {
      const next = !collapsed;
      try {
        window.localStorage.setItem(SIDEBAR_STORAGE_KEY, String(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  const handleRefresh = useCallback(async () => {
    const ok = await refresh();
    onToast({
      type: ok ? 'success' : 'error',
      content: ok ? 'Synchronized with backend.' : 'Unable to refresh all resources.',
    });
  }, [onToast, refresh]);

  useEffect(() => {
    if (loadError) {
      onToast({ type: 'error', content: loadError });
    }
  }, [loadError, onToast]);

  const activeItem = useMemo(() => {
    return navItems.find((item) => location.pathname.startsWith(item.path)) ?? navItems[0];
  }, [location.pathname]);

  useEffect(() => {
    document.title = `${activeItem.label} | RefData Hub`;
  }, [activeItem]);

  useEffect(() => {
    setIsSidebarOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (isSidebarOpen) {
      setIsSidebarCollapsed(false);
    }
  }, [isSidebarOpen]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'b' && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        toggleSidebar();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [toggleSidebar]);

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 1024 && isSidebarOpen) {
        setIsSidebarOpen(false);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [isSidebarOpen]);

  const isNavActive = useCallback(
    (path: string) => location.pathname.startsWith(path),
    [location.pathname],
  );

  const toastAccentClass = toast?.type === 'error'
    ? 'border-brand-danger/30 bg-brand-danger/10 text-brand-danger'
    : 'border-brand-success/30 bg-brand-success/10 text-brand-success';

  return (
    <div className="h-screen overflow-hidden bg-bg-primary flex">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:p-4 focus:bg-brand-primary focus:text-brand-accent-contrast focus:font-bold focus:rounded-br-xl"
      >
        Skip to main content
      </a>

      <Sidebar
        collapsed={isSidebarCollapsed}
        mobileOpen={isSidebarOpen}
        onToggle={toggleSidebar}
        onCloseMobile={() => setIsSidebarOpen(false)}
        isActive={isNavActive}
        onNavigate={(path) => navigate(path)}
      />

      <div
        className={cn(
          'flex-1 flex flex-col min-w-0 min-h-0 transition-all duration-300',
          isSidebarCollapsed ? 'lg:ml-[72px]' : 'lg:ml-[280px]',
        )}
      >
        <TopBar
          onMenuToggle={() => setIsSidebarOpen((open) => !open)}
          config={config}
          isLoading={isLoading}
          onSync={() => void handleRefresh()}
          theme={themeChoice}
          onThemeChange={onThemeChange}
          resolvedMode={resolvedMode}
        />

        <main
          id="main-content"
          className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden pb-8 scrollbar-thin"
          role="main"
          tabIndex={-1}
        >
          <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-brand-primary">
                RefData Hub
              </p>
              <h1 className="text-2xl font-black text-text-primary tracking-tight mt-1">
                {activeItem.label}
              </h1>
              <p className="text-xs text-text-tertiary mt-1">
                {pageSubtitles[activeItem.path] ?? pageSubtitles['/dashboard']}
              </p>
            </div>

            <Routes>
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              <Route path="/dashboard" element={<DashboardPage onToast={onToast} />} />
              <Route path="/dimensions" element={<DimensionsPage onToast={onToast} />} />
              <Route path="/dimensions/:code" element={<DimensionDetailPage onToast={onToast} />} />
              <Route path="/canonical-library" element={<CanonicalLibraryPage onToast={onToast} />} />
              <Route path="/dimension-relations" element={<DimensionRelationsPage onToast={onToast} />} />
              <Route path="/connections" element={<ConnectionsPage onToast={onToast} />} />
              <Route
                path="/connections/:connectionId"
                element={<SourceConnectionDetailPage onToast={onToast} />}
              />
              <Route path="/field-mappings" element={<FieldMappingsPage onToast={onToast} />} />
              <Route path="/match-insights" element={<MatchInsightsPage onToast={onToast} />} />
              <Route path="/suggestions" element={<SuggestionsPage onToast={onToast} />} />
              <Route path="/mapping-history" element={<MappingHistoryPage onToast={onToast} />} />
              <Route path="/settings" element={<SettingsPage onToast={onToast} />} />
              <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Routes>
          </div>
        </main>

        <div className="fixed bottom-6 right-6 z-[10000] flex max-w-md flex-col gap-3">
          {toast && (
            <div
              key={toastKey}
              role="status"
              className={cn(
                'bg-widget-bg border rounded-2xl shadow-lg p-4 backdrop-blur-md',
                toastAccentClass,
              )}
            >
              <div className="mb-1.5 flex items-center justify-between text-[11px] font-bold uppercase tracking-wider">
                <span>Notification</span>
                <button
                  type="button"
                  className="text-text-tertiary transition hover:text-text-primary"
                  onClick={onCloseToast}
                  aria-label="Dismiss notification"
                >
                  ×
                </button>
              </div>
              <p className="text-sm font-medium text-text-primary">{toast.content}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const App = () => {
  const [themeChoice, setThemeChoice] = useState<ThemeChoice>(() => resolveInitialTheme('light'));
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const [toastKey, setToastKey] = useState(0);

  useEffect(() => {
    applyTheme(themeChoice);
    persistTheme(themeChoice);
  }, [themeChoice]);

  const handleToast = useCallback((message: ToastMessage) => {
    setToast(message);
    setToastKey((key) => key + 1);
  }, []);

  return (
    <BrowserRouter>
      <AppStateProvider>
        <AppScaffold
          themeChoice={themeChoice}
          onThemeChange={setThemeChoice}
          toast={toast}
          toastKey={toastKey}
          onToast={handleToast}
          onCloseToast={() => setToast(null)}
        />
      </AppStateProvider>
    </BrowserRouter>
  );
};

export default App;
export { AppScaffold };
export type { AppScaffoldProps };
