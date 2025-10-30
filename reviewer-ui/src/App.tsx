import { useCallback, useEffect, useMemo, useState } from 'react';
import { BrowserRouter, Link, Navigate, NavLink, Route, Routes, useLocation } from 'react-router-dom';
import { Badge, Button, Container, Form, Spinner, Toast, ToastContainer } from 'react-bootstrap';

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

  const toastVariant = toast?.type === 'error' ? 'danger' : 'success';

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
        <Button
          variant="outline-light"
          size="sm"
          className="app-sidebar__collapse-toggle d-none d-lg-inline-flex"
          onClick={() => setIsSidebarCollapsed((collapsed) => !collapsed)}
          aria-controls={sidebarId}
          aria-expanded={!isSidebarCollapsed}
          aria-label={isSidebarCollapsed ? 'Expand navigation menu' : 'Collapse navigation menu'}
        >
          <span aria-hidden="true">{isSidebarCollapsed ? '»' : '«'}</span>
          <span className="visually-hidden">
            {isSidebarCollapsed ? 'Expand navigation menu' : 'Collapse navigation menu'}
          </span>
        </Button>
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
        <div className="app-sidebar__footer text-body-secondary">
          <p className="mb-0 small">Curate canonical dimensions with confidence and audit-ready lineage.</p>
        </div>
      </aside>
      <button
        type="button"
        className={`app-sidebar-overlay d-lg-none${isSidebarOpen ? ' is-visible' : ''}`}
        aria-hidden={!isSidebarOpen}
        aria-label="Close navigation"
        tabIndex={isSidebarOpen ? 0 : -1}
        onClick={() => setIsSidebarOpen(false)}
      />
      <div className="app-main">
        <header className="app-header">
          <div className="app-header__titles">
            <Button
              variant="outline-light"
              size="sm"
              className="app-sidebar-toggle d-lg-none"
              onClick={() => setIsSidebarOpen((open) => !open)}
              aria-label={isSidebarOpen ? 'Hide navigation menu' : 'Show navigation menu'}
            >
              Menu
            </Button>
            <p className="app-header__eyebrow">RefData Hub</p>
            <h1 className="app-header__title">{activeItem.label}</h1>
            <p className="app-header__subtitle">
              Operationalise semantic standards with observability inspired by OpenMetadata.
            </p>
          </div>
          <div className="app-header__actions">
            {config && (
              <Badge bg="dark" className="text-uppercase app-header__badge">
                Matcher: {config.matcher_backend}
              </Badge>
            )}
            <Form.Select
              size="sm"
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
            </Form.Select>
            <Button
              variant="primary"
              className="app-header__button"
              onClick={() => void handleRefresh()}
              disabled={isLoading}
            >
              {isLoading ? (
                <span className="d-inline-flex align-items-center gap-2">
                  <Spinner animation="border" size="sm" role="status" aria-hidden="true" />
                  Syncing…
                </span>
              ) : (
                'Sync data'
              )}
            </Button>
          </div>
        </header>
        <main className="app-content">
          <Container fluid="lg" className="app-content__inner">
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
          </Container>
        </main>
        <ToastContainer position="bottom-end" className="p-3 app-toast-container">
          {toast && (
            <Toast
              bg={toastVariant}
              key={toastKey}
              show
              onClose={onCloseToast}
              delay={6000}
              autohide
            >
              <Toast.Header closeButton closeLabel="Dismiss notification">
                <strong className="me-auto">Notification</strong>
              </Toast.Header>
              <Toast.Body className="text-white">{toast.content}</Toast.Body>
            </Toast>
          )}
        </ToastContainer>
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
