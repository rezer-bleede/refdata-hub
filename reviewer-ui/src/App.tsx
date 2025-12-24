import { useCallback, useEffect, useMemo, useState } from 'react';
import { BrowserRouter, Link, Navigate, NavLink, Route, Routes, useLocation } from 'react-router-dom';

import ConnectionsPage from './pages/ConnectionsPage';
import DashboardPage from './pages/DashboardPage';
import FieldMappingsPage from './pages/FieldMappingsPage';
import MappingHistoryPage from './pages/MappingHistoryPage';
import MatchInsightsPage from './pages/MatchInsightsPage';
import SuggestionsPage from './pages/SuggestionsPage';
import CanonicalLibraryPage from './pages/CanonicalLibraryPage';
import DimensionsPage from './pages/DimensionsPage';
import DimensionRelationsPage from './pages/DimensionRelationsPage';
import SettingsPage from './pages/SettingsPage';
import SourceConnectionDetailPage from './pages/SourceConnectionDetailPage';
import { AppStateProvider, useAppState } from './state/AppStateContext';
import { applyTheme, themeDefinitions, themeOrder, ThemeChoice } from './themes';
import type { ToastMessage } from './types';

interface AppScaffoldProps {
  themeChoice: ThemeChoice;
  onThemeChange: (choice: ThemeChoice) => void;
  toast: ToastMessage | null;
  toastKey: number;
  onToast: (toast: ToastMessage) => void;
  onCloseToast: () => void;
}

interface NavItem {
  path: string;
  label: string;
}

const navItems: NavItem[] = [
  { path: '/dashboard', label: 'Dashboard' },
  { path: '/dimensions', label: 'Dimensions' },
  { path: '/canonical-library', label: 'Canonical Library' },
  { path: '/dimension-relations', label: 'Dimension Relations' },
  { path: '/connections', label: 'Source Connections' },
  { path: '/field-mappings', label: 'Field Mappings' },
  { path: '/match-insights', label: 'Match Insights' },
  { path: '/suggestions', label: 'Suggestions' },
  { path: '/mapping-history', label: 'Mapping History' },
  { path: '/settings', label: 'Settings' },
];

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
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const sidebarId = 'app-primary-navigation';

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

  const toastAccentClass = toast?.type === 'error'
    ? 'border-red-500/50 bg-red-500/10 text-red-100'
    : 'border-emerald-400/50 bg-emerald-400/10 text-emerald-100';

  useEffect(() => {
    setIsSidebarOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (isSidebarOpen) {
      setIsSidebarCollapsed(false);
    }
  }, [isSidebarOpen]);

  return (
    <div className={`app-shell theme-${themeChoice}`}>
      <aside
        id={sidebarId}
        className={`app-sidebar${isSidebarOpen ? ' is-open' : ''}${isSidebarCollapsed ? ' is-collapsed' : ''}`}
        aria-label="Primary navigation"
      >
        <Link to="/dashboard" className="app-sidebar__brand" onClick={() => setIsSidebarOpen(false)}>
          <span className="app-sidebar__brand-mark" aria-hidden />
          <span className="app-sidebar__brand-text">
            <span className="app-sidebar__brand-title">RefData Hub</span>
            <span className="app-sidebar__brand-subtitle">Metadata stewardship workspace</span>
          </span>
        </Link>
        <button
          type="button"
          className="app-sidebar__collapse-toggle"
          onClick={() => setIsSidebarCollapsed((collapsed) => !collapsed)}
          aria-controls={sidebarId}
          aria-expanded={!isSidebarCollapsed}
          aria-label={isSidebarCollapsed ? 'Expand navigation menu' : 'Collapse navigation menu'}
        >
          <span aria-hidden="true">{isSidebarCollapsed ? '»' : '«'}</span>
          <span className="visually-hidden">
            {isSidebarCollapsed ? 'Expand navigation menu' : 'Collapse navigation menu'}
          </span>
        </button>
        <nav className="app-sidebar__nav">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) => `app-nav-link${isActive ? ' active' : ''}`}
              onClick={() => setIsSidebarOpen(false)}
              aria-label={item.label}
              title={item.label}
            >
              <span className="app-nav-indicator" aria-hidden />
              <span className="app-nav-label">{item.label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="app-sidebar__footer text-slate-400">
          <p className="mb-0 text-xs">Curate canonical dimensions with confidence and audit-ready lineage.</p>
        </div>
      </aside>
      <button
        type="button"
        className={`app-sidebar-overlay lg:hidden${isSidebarOpen ? ' is-visible' : ''}`}
        aria-hidden={!isSidebarOpen}
        aria-label="Close navigation"
        tabIndex={isSidebarOpen ? 0 : -1}
        onClick={() => setIsSidebarOpen(false)}
      />
      <div className="app-main">
        <header className="app-header">
          <div className="app-header__titles">
            <button
              type="button"
              className="app-sidebar-toggle lg:hidden"
              onClick={() => setIsSidebarOpen((open) => !open)}
              aria-label={isSidebarOpen ? 'Hide navigation menu' : 'Show navigation menu'}
            >
              Menu
            </button>
            <p className="app-header__eyebrow">RefData Hub</p>
            <h1 className="app-header__title">{activeItem.label}</h1>
            <p className="app-header__subtitle">
              Operationalise semantic standards with observability inspired by OpenMetadata.
            </p>
          </div>
          <div className="app-header__actions">
            {config && (
              <span className="app-header__badge">
                Matcher: {config.matcher_backend}
              </span>
            )}
            <select
              value={themeChoice}
              aria-label="Select UI theme"
              className="app-header__select"
              onChange={(event) => onThemeChange(event.target.value as ThemeChoice)}
            >
              {themeOrder.map((choice) => (
                <option key={choice} value={choice}>
                  {themeDefinitions[choice].label}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="app-header__button"
              onClick={() => void handleRefresh()}
              disabled={isLoading}
            >
              {isLoading ? (
                <span className="flex items-center gap-2">
                  <span
                    className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white"
                    role="status"
                    aria-hidden="true"
                  />
                  Syncing…
                </span>
              ) : (
                'Sync data'
              )}
            </button>
          </div>
        </header>
        <main className="app-content">
          <div className="app-content__inner">
            <Routes>
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              <Route path="/dashboard" element={<DashboardPage onToast={onToast} />} />
              <Route path="/dimensions" element={<DimensionsPage onToast={onToast} />} />
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
        <div className="app-toast-container">
          {toast && (
            <div
              key={toastKey}
              role="status"
              className={`surface-card surface-card--accent border ${toastAccentClass} backdrop-blur`}
            >
              <div className="mb-2 flex items-center justify-between text-xs uppercase tracking-[0.3em] text-slate-400">
                <span>Notification</span>
                <button
                  type="button"
                  className="text-slate-400 transition hover:text-white"
                  onClick={onCloseToast}
                  aria-label="Dismiss notification"
                >
                  ×
                </button>
              </div>
              <p className="text-sm text-slate-100">{toast.content}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const App = () => {
  const [themeChoice, setThemeChoice] = useState<ThemeChoice>('dark');
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const [toastKey, setToastKey] = useState(0);

  useEffect(() => {
    applyTheme(themeChoice);
  }, [themeChoice]);

  const handleToast = useCallback((message: ToastMessage) => {
    setToast(message);
    setToastKey((key) => key + 1);
  }, []);

  const handleThemeChange = useCallback((choice: ThemeChoice) => {
    setThemeChoice(choice);
  }, []);

  return (
    <BrowserRouter>
      <AppStateProvider>
        <AppScaffold
          themeChoice={themeChoice}
          onThemeChange={handleThemeChange}
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
export { AppScaffold, navItems };
