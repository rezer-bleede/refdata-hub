import { useCallback, useEffect, useMemo, useState } from 'react';
import { BrowserRouter, Link, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import {
  Badge,
  Button,
  Container,
  Form,
  Nav,
  Navbar,
  Spinner,
  Toast,
  ToastContainer,
} from 'react-bootstrap';

import ConnectionsPage from './pages/ConnectionsPage';
import DashboardPage from './pages/DashboardPage';
import FieldMappingsPage from './pages/FieldMappingsPage';
import MappingHistoryPage from './pages/MappingHistoryPage';
import MatchInsightsPage from './pages/MatchInsightsPage';
import SuggestionsPage from './pages/SuggestionsPage';
import CanonicalLibraryPage from './pages/CanonicalLibraryPage';
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
  { path: '/canonical-library', label: 'Canonical Library' },
  { path: '/connections', label: 'Source Connections' },
  { path: '/field-mappings', label: 'Field Mappings' },
  { path: '/match-insights', label: 'Match Insights' },
  { path: '/suggestions', label: 'Suggestions' },
  { path: '/mapping-history', label: 'Mapping History' },
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

  const activePath = useMemo(() => {
    const current = navItems.find((item) => location.pathname.startsWith(item.path));
    return current ? current.path : '/dashboard';
  }, [location.pathname]);

  const toastVariant = toast?.type === 'error' ? 'danger' : 'success';

  return (
    <div className="min-vh-100 bg-body-tertiary">
      <header className="border-bottom bg-body">
        <Navbar expand="lg" className="py-3" bg="body" data-testid="global-navbar">
          <Container fluid className="gap-3">
            <Navbar.Brand as={Link} to="/dashboard" className="fw-semibold">
              RefData Hub
              <span className="d-block fs-6 text-body-secondary fw-normal">
                Govern canonical reference data, source mappings, and match quality in one place.
              </span>
            </Navbar.Brand>
            <div className="d-flex flex-column flex-lg-row align-items-lg-center gap-2 ms-auto">
              {config && (
                <Badge bg="secondary" className="text-uppercase">
                  Matcher: {config.matcher_backend}
                </Badge>
              )}
              <Form.Select
                size="sm"
                value={themeChoice}
                aria-label="Select theme"
                className="w-auto"
                onChange={(event) => onThemeChange(event.target.value as ThemeChoice)}
              >
                {themeOrder.map((choice) => (
                  <option key={choice} value={choice}>
                    {themeDefinitions[choice].label}
                  </option>
                ))}
              </Form.Select>
              <Button
                variant="outline-primary"
                size="sm"
                onClick={() => void handleRefresh()}
                disabled={isLoading}
              >
                {isLoading ? (
                  <span className="d-inline-flex align-items-center gap-2">
                    <Spinner animation="border" size="sm" role="status" aria-hidden="true" />
                    Refreshing…
                  </span>
                ) : (
                  'Refresh'
                )}
              </Button>
            </div>
            <Navbar.Toggle aria-controls="main-navigation" />
            <Navbar.Collapse id="main-navigation" className="mt-3 mt-lg-0">
              <Nav className="me-auto">
                {navItems.map((item) => (
                  <Nav.Link
                    key={item.path}
                    as={Link}
                    to={item.path}
                    active={activePath === item.path}
                    className="fw-medium"
                  >
                    {item.label}
                  </Nav.Link>
                ))}
              </Nav>
            </Navbar.Collapse>
          </Container>
        </Navbar>
      </header>

      <main>
        <Container fluid="md" className="py-4">
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<DashboardPage onToast={onToast} />} />
            <Route path="/canonical-library" element={<CanonicalLibraryPage onToast={onToast} />} />
            <Route path="/connections" element={<ConnectionsPage onToast={onToast} />} />
            <Route path="/field-mappings" element={<FieldMappingsPage onToast={onToast} />} />
            <Route path="/match-insights" element={<MatchInsightsPage onToast={onToast} />} />
            <Route path="/suggestions" element={<SuggestionsPage onToast={onToast} />} />
            <Route path="/mapping-history" element={<MappingHistoryPage onToast={onToast} />} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </Container>
      </main>

      <ToastContainer position="bottom-end" className="p-3">
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
