import { useCallback, useEffect, useMemo, useState } from 'react';
import { BrowserRouter, Link, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import RefreshRoundedIcon from '@mui/icons-material/RefreshRounded';
import { Alert, AppBar, Box, Button, Chip, CircularProgress, Container, CssBaseline, FormControl, IconButton, InputLabel, ListItemIcon, ListItemText, MenuItem, Select, Snackbar, Stack, Toolbar, Typography } from '@mui/material';
import { ThemeProvider, createTheme, responsiveFontSizes } from '@mui/material/styles';

import ConnectionsPage from './pages/ConnectionsPage';
import DashboardPage from './pages/DashboardPage';
import FieldMappingsPage from './pages/FieldMappingsPage';
import MappingHistoryPage from './pages/MappingHistoryPage';
import MatchInsightsPage from './pages/MatchInsightsPage';
import SuggestionsPage from './pages/SuggestionsPage';
import { AppStateProvider, useAppState } from './state/AppStateContext';
import { themeDefinitions, themeOrder, ThemeChoice } from './themes';
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
    onToast({ type: ok ? 'success' : 'error', content: ok ? 'Synchronized with backend' : 'Unable to refresh all resources' });
  }, [onToast, refresh]);

  useEffect(() => {
    if (loadError) {
      onToast({ type: 'error', content: loadError });
    }
  }, [loadError, onToast]);

  return (
    <Box sx={{ bgcolor: 'background.default', minHeight: '100vh', pb: 6 }}>
      <AppBar
        position="sticky"
        color="default"
        elevation={0}
        sx={{
          backgroundImage: 'none',
          borderBottom: 1,
          borderColor: 'divider',
          backdropFilter: 'blur(12px)',
        }}
      >
        <Toolbar sx={{ flexWrap: 'wrap', gap: 2, py: 2 }}>
          <Box sx={{ flexGrow: 1 }}>
            <Typography variant="h5" fontWeight={600} gutterBottom>
              RefData Hub
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Govern canonical reference data, source mappings, and match quality in one place.
            </Typography>
          </Box>

          {config && (
            <Chip
              label={`Matcher: ${config.matcher_backend}`}
              color="secondary"
              variant="outlined"
              sx={{ alignSelf: { xs: 'flex-start', sm: 'center' } }}
            />
          )}

          <Stack direction="row" spacing={1} alignItems="center">
            <FormControl size="small" sx={{ minWidth: 160 }}>
              <InputLabel id="theme-select-label">Theme</InputLabel>
              <Select
                labelId="theme-select-label"
                label="Theme"
                value={themeChoice}
                onChange={(event) => onThemeChange(event.target.value as ThemeChoice)}
              >
                {themeOrder.map((choice) => (
                  <MenuItem key={choice} value={choice}>
                    <ListItemIcon>
                      <Box
                        sx={{
                          width: 14,
                          height: 14,
                          borderRadius: '50%',
                          bgcolor: (themeDefinitions[choice].options.palette?.primary as any)?.main,
                          boxShadow: 1,
                        }}
                      />
                    </ListItemIcon>
                    <ListItemText primary={themeDefinitions[choice].label} />
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <IconButton aria-label="Refresh" onClick={() => void handleRefresh()}>
              {isLoading ? <CircularProgress size={22} /> : <RefreshRoundedIcon />}
            </IconButton>
          </Stack>
        </Toolbar>
        <Toolbar sx={{ gap: 1, flexWrap: 'wrap', pb: 2 }}>
          {navItems.map((item) => {
            const active = location.pathname.startsWith(item.path);
            return (
              <Button
                key={item.path}
                variant={active ? 'contained' : 'text'}
                color={active ? 'primary' : 'inherit'}
                component={Link}
                to={item.path}
              >
                {item.label}
              </Button>
            );
          })}
        </Toolbar>
      </AppBar>

      <Container maxWidth="xl" sx={{ py: { xs: 3, md: 5 } }}>
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<DashboardPage onToast={onToast} />} />
          <Route path="/connections" element={<ConnectionsPage onToast={onToast} />} />
          <Route path="/field-mappings" element={<FieldMappingsPage onToast={onToast} />} />
          <Route path="/match-insights" element={<MatchInsightsPage onToast={onToast} />} />
          <Route path="/suggestions" element={<SuggestionsPage onToast={onToast} />} />
          <Route path="/mapping-history" element={<MappingHistoryPage onToast={onToast} />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </Container>

      {toast && (
        <Snackbar
          key={toastKey}
          open
          autoHideDuration={6000}
          onClose={onCloseToast}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        >
          <Alert onClose={onCloseToast} severity={toast.type} variant="filled" sx={{ width: '100%' }}>
            {toast.content}
          </Alert>
        </Snackbar>
      )}
    </Box>
  );
};

const App = () => {
  const [themeChoice, setThemeChoice] = useState<ThemeChoice>('dark');
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const [toastKey, setToastKey] = useState(0);

  const theme = useMemo(
    () => responsiveFontSizes(createTheme(themeDefinitions[themeChoice].options)),
    [themeChoice],
  );

  const handleToast = useCallback((message: ToastMessage) => {
    setToast(message);
    setToastKey((key) => key + 1);
  }, []);

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline enableColorScheme />
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
    </ThemeProvider>
  );
};

export default App;
