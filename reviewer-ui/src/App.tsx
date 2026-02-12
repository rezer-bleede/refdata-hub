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
import DimensionDetailPage from './pages/DimensionDetailPage';
import DimensionRelationsPage from './pages/DimensionRelationsPage';
import SettingsPage from './pages/SettingsPage';
import SourceConnectionDetailPage from './pages/SourceConnectionDetailPage';
import { AppStateProvider, useAppState } from './state/AppStateContext';
import { applyTheme, persistTheme, resolveInitialTheme, themeDefinitions, themeOrder, ThemeChoice } from './themes';
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
  icon: JSX.Element;
}

const iconProps = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.6,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
} as const;

const navItems: NavItem[] = [
  {
    path: '/dashboard',
    label: 'Dashboard',
    icon: (
      <svg {...iconProps}>
        <rect x="4" y="4" width="7" height="7" rx="2" />
        <rect x="13" y="4" width="7" height="7" rx="2" />
        <rect x="4" y="13" width="7" height="7" rx="2" />
        <rect x="13" y="13" width="7" height="7" rx="2" />
      </svg>
    ),
  },
  {
    path: '/dimensions',
    label: 'Dimensions',
    icon: (
      <svg {...iconProps}>
        <circle cx="7" cy="7" r="2.25" />
        <circle cx="17" cy="7" r="2.25" />
        <circle cx="7" cy="17" r="2.25" />
        <path d="M9.25 7h5.5M7 9.25v5.5M9.4 15 15 9.4" />
      </svg>
    ),
  },
  {
    path: '/canonical-library',
    label: 'Canonical Library',
    icon: (
      <svg {...iconProps}>
        <path d="M7 5.5h8.5a2 2 0 0 1 2 2v9.75a1.25 1.25 0 0 1-1.25 1.25H7A2.5 2.5 0 0 1 4.5 16V8A2.5 2.5 0 0 1 7 5.5Z" />
        <path d="M16.5 7.25H10a1.5 1.5 0 0 0-1.5 1.5V18" />
        <path d="M9 10.5h4" />
      </svg>
    ),
  },
  {
    path: '/dimension-relations',
    label: 'Dimension Relations',
    icon: (
      <svg {...iconProps}>
        <circle cx="7" cy="12" r="2.25" />
        <circle cx="17" cy="7" r="2.25" />
        <circle cx="17" cy="17" r="2.25" />
        <path d="M9.25 12H14.5M14.75 8.25 11 10M14.75 15.75 11 14" />
      </svg>
    ),
  },
  {
    path: '/connections',
    label: 'Source Connections',
    icon: (
      <svg {...iconProps}>
        <path d="M9.5 7.5H7.25A2.25 2.25 0 0 0 5 9.75v4.5A2.25 2.25 0 0 0 7.25 16.5H9.5" />
        <path d="m13 7 3.5-3.5M13 17l3.5 3.5" />
        <rect x="9.5" y="6" width="5" height="12" rx="2.25" />
      </svg>
    ),
  },
  {
    path: '/field-mappings',
    label: 'Field Mappings',
    icon: (
      <svg {...iconProps}>
        <path d="M6.5 6.5h5.75a1.25 1.25 0 0 1 1.25 1.25v2.5A1.25 1.25 0 0 1 12.25 11.5H6.5z" />
        <path d="M6.5 12.5h5.75a1.25 1.25 0 0 1 1.25 1.25v2.5A1.25 1.25 0 0 1 12.25 17.5H6.5z" />
        <path d="M16.5 9.25h1.25A1.25 1.25 0 0 1 19 10.5v3a1.25 1.25 0 0 1-1.25 1.25H16.5" />
      </svg>
    ),
  },
  {
    path: '/match-insights',
    label: 'Match Insights',
    icon: (
      <svg {...iconProps}>
        <path d="M6 16.5 9.25 12l3 3L18 9" />
        <path d="M5.5 7.5h-.25A1.25 1.25 0 0 0 4 8.75v6.5A1.75 1.75 0 0 0 5.75 17h12.5" />
        <path d="M8 6.5h10.25A1.75 1.75 0 0 1 20 8.25v7.5" />
      </svg>
    ),
  },
  {
    path: '/suggestions',
    label: 'Suggestions',
    icon: (
      <svg {...iconProps}>
        <path d="m7 12.5 2.25-.75L10 9.5 12.5 7l.75 2.25 2.25.75L13.25 11l-.75 2.25L10.25 12Z" />
        <path d="M7.5 17.5c.6.4 1.35.75 2.5.75 2.5 0 4-1.5 6.25-1.5.85 0 1.5.2 2 .5" />
      </svg>
    ),
  },
  {
    path: '/mapping-history',
    label: 'Mapping History',
    icon: (
      <svg {...iconProps}>
        <path d="M12 6.25a5.75 5.75 0 1 0 5.32 8.06" />
        <path d="M12 8.5v3.5l2.25 1.25" />
        <path d="M9 6.5V5.25A1.25 1.25 0 0 1 10.25 4h6.5A1.25 1.25 0 0 1 18 5.25v6.5A1.25 1.25 0 0 1 16.75 13H15" />
      </svg>
    ),
  },
  {
    path: '/settings',
    label: 'Settings',
    icon: (
      <svg {...iconProps}>
        <path d="M12 9.25a2.75 2.75 0 1 0 0 5.5 2.75 2.75 0 0 0 0-5.5Z" />
        <path d="M19 12a7 7 0 0 0-.09-1.14l1.48-.86-1.5-2.6-1.5.86a7 7 0 0 0-1.97-1.14l-.23-1.72H8.81l-.23 1.72A7 7 0 0 0 6.6 8.26l-1.5-.86-1.5 2.6 1.48.86A7 7 0 0 0 5 12c0 .39.03.77.09 1.14l-1.48.86 1.5 2.6 1.5-.86a7 7 0 0 0 1.97 1.14l.23 1.72h4.96l.23-1.72a7 7 0 0 0 1.97-1.14l1.5.86 1.5-2.6-1.48-.86A7 7 0 0 0 19 12Z" />
      </svg>
    ),
  },
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
        <div className="app-sidebar__top">
          <Link to="/dashboard" className="app-sidebar__brand" onClick={() => setIsSidebarOpen(false)}>
            <span className="app-sidebar__brand-mark" data-testid="app-logo-mark">
              <svg
                viewBox="0 0 64 64"
                role="img"
                aria-label="RefData Hub logo"
                className="app-sidebar__brand-logo"
              >
                <defs>
                  <linearGradient id="logo-grad-primary" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stop-color="#0ea5e9" />
                    <stop offset="100%" stop-color="#6366f1" />
                  </linearGradient>
                  <linearGradient id="logo-grad-accent" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stop-color="#22d3ee" />
                    <stop offset="100%" stop-color="#0ea5e9" />
                  </linearGradient>
                  <filter id="logo-glow" x="-50%" y="-50%" width="200%" height="200%">
                    <feGaussianBlur stdDeviation="1.5" result="coloredBlur"/>
                    <feMerge>
                      <feMergeNode in="coloredBlur"/>
                      <feMergeNode in="SourceGraphic"/>
                    </feMerge>
                  </filter>
                </defs>
                
                <rect width="64" height="64" rx="14" fill="#0f172a"/>
                <rect width="64" height="64" rx="14" fill="none" stroke="url(#logo-grad-primary)" strokeWidth="2"/>
                
                {/* Left scattered dots - raw data */}
                <g fill="#0ea5e9" opacity="0.8">
                  <circle cx="14" cy="20" r="2.5"/>
                  <circle cx="22" cy="16" r="2"/>
                  <circle cx="18" cy="28" r="3"/>
                  <circle cx="12" cy="36" r="2"/>
                  <circle cx="20" cy="40" r="2.5"/>
                </g>
                
                {/* Center arrow - transformation */}
                <path d="M26 32 L34 32 M32 29 L34 32 L32 35" stroke="url(#logo-grad-accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" filter="url(#logo-glow)"/>
                
                {/* Right organized bars - canonical data */}
                <g fill="#6366f1" opacity="0.9">
                  <rect x="38" y="18" width="16" height="3" rx="1.5"/>
                  <rect x="38" y="25" width="16" height="3" rx="1.5"/>
                  <rect x="38" y="32" width="12" height="3" rx="1.5"/>
                  <rect x="38" y="39" width="8" height="3" rx="1.5"/>
                </g>
                
                {/* Center point - unification */}
                <circle cx="32" cy="32" r="4" fill="#22d3ee" filter="url(#logo-glow)"/>
              </svg>
            </span>
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
        </div>
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
              <span
                className="app-nav-icon"
                aria-hidden
                data-testid={`nav-icon-${item.path.replace(/\//g, '-')}`}
              >
                {item.icon}
              </span>
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
              Operationalise semantic standards with observability inspired by modern data catalogs.
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
  const [themeChoice, setThemeChoice] = useState<ThemeChoice>(() => resolveInitialTheme('dark'));
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
