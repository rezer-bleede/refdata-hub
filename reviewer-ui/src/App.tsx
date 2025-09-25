import { useCallback, useEffect, useMemo, useState } from 'react';
import SaveRoundedIcon from '@mui/icons-material/SaveRounded';
import PlayArrowRoundedIcon from '@mui/icons-material/PlayArrowRounded';
import AddCircleRoundedIcon from '@mui/icons-material/AddCircleRounded';
import {
  Alert,
  AppBar,
  Box,
  Button,
  Chip,
  CircularProgress,
  Container,
  CssBaseline,
  Divider,
  FormControl,
  Grid,
  InputLabel,
  ListItemIcon,
  ListItemText,
  MenuItem,
  Paper,
  Select,
  Snackbar,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Toolbar,
  Typography,
} from '@mui/material';
import { createTheme, responsiveFontSizes, ThemeProvider } from '@mui/material/styles';
import {
  createCanonicalValue,
  fetchCanonicalValues,
  fetchConfig,
  proposeMatch,
  updateConfig,
} from './api';
import { themeDefinitions, themeOrder, ThemeChoice } from './themes';
import type { CanonicalValue, MatchCandidate, MatchResponse, SystemConfig } from './types';

interface ToastMessage {
  type: 'success' | 'error';
  content: string;
}

const matcherOptions = [
  { value: 'embedding', label: 'Embedding based (default)' },
  { value: 'llm', label: 'LLM orchestration' },
];

const App = () => {
  const [config, setConfig] = useState<SystemConfig | null>(null);
  const [canonicalValues, setCanonicalValues] = useState<CanonicalValue[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const [configDraft, setConfigDraft] = useState<Record<string, string>>({});
  const [matchInput, setMatchInput] = useState('');
  const [matchDimension, setMatchDimension] = useState('');
  const [matchResults, setMatchResults] = useState<MatchResponse | null>(null);
  const [newCanonical, setNewCanonical] = useState({
    dimension: '',
    canonical_label: '',
    description: '',
  });
  const [savingConfig, setSavingConfig] = useState(false);
  const [runningMatch, setRunningMatch] = useState(false);
  const [creatingCanonical, setCreatingCanonical] = useState(false);
  const [themeChoice, setThemeChoice] = useState<ThemeChoice>('dark');

  const theme = useMemo(
    () => responsiveFontSizes(createTheme(themeDefinitions[themeChoice].options)),
    [themeChoice],
  );

  const availableDimensions = useMemo(() => {
    const dimensionSet = new Set<string>();
    canonicalValues.forEach((value) => dimensionSet.add(value.dimension));
    if (config?.default_dimension) {
      dimensionSet.add(config.default_dimension);
    }
    return Array.from(dimensionSet).sort();
  }, [canonicalValues, config?.default_dimension]);

  const loadInitialData = useCallback(async () => {
    try {
      setIsLoading(true);
      const [configResponse, canonicalResponse] = await Promise.all([
        fetchConfig(),
        fetchCanonicalValues(),
      ]);
      setConfig(configResponse);
      setCanonicalValues(
        canonicalResponse.sort((a, b) => a.canonical_label.localeCompare(b.canonical_label)),
      );
    } catch (error) {
      console.error(error);
      setToast({ type: 'error', content: 'Failed to load initial data' });
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadInitialData();
  }, [loadInitialData]);

  const handleConfigChange = (key: string, value: string) => {
    setConfigDraft((draft) => ({ ...draft, [key]: value }));
  };

  const handleSaveConfig = async () => {
    if (!config) return;
    setSavingConfig(true);
    setToast(null);
    try {
      const payload: Record<string, string | number> = {};
      Object.entries(configDraft).forEach(([key, value]) => {
        if (value !== '') {
          if (key === 'match_threshold' || key === 'top_k') {
            payload[key] = Number(value);
          } else {
            payload[key] = value;
          }
        }
      });
      const updated = await updateConfig(payload);
      setConfig(updated);
      setConfigDraft({});
      setToast({ type: 'success', content: 'Configuration updated' });
    } catch (error) {
      console.error(error);
      setToast({ type: 'error', content: 'Unable to update configuration' });
    } finally {
      setSavingConfig(false);
    }
  };

  const handleRunMatch = async () => {
    if (!matchInput.trim()) {
      setToast({ type: 'error', content: 'Enter a raw value to match.' });
      return;
    }
    setRunningMatch(true);
    setToast(null);
    try {
      const response = await proposeMatch(matchInput.trim(), matchDimension || undefined);
      setMatchResults(response);
    } catch (error) {
      console.error(error);
      setToast({ type: 'error', content: 'Matching request failed' });
    } finally {
      setRunningMatch(false);
    }
  };

  const handleCreateCanonical = async () => {
    if (!newCanonical.dimension || !newCanonical.canonical_label) {
      setToast({
        type: 'error',
        content: 'Provide dimension and label to create a canonical value.',
      });
      return;
    }
    setCreatingCanonical(true);
    setToast(null);
    try {
      const created = await createCanonicalValue(newCanonical);
      setCanonicalValues((values) =>
        [...values, created].sort((a, b) => a.canonical_label.localeCompare(b.canonical_label)),
      );
      setNewCanonical({ dimension: '', canonical_label: '', description: '' });
      setToast({ type: 'success', content: 'Canonical value added' });
    } catch (error) {
      console.error(error);
      setToast({ type: 'error', content: 'Failed to add canonical value' });
    } finally {
      setCreatingCanonical(false);
    }
  };

  const renderMatches = (matches: MatchCandidate[]) => {
    if (!matches.length) {
      return (
        <Alert severity="info" sx={{ mt: 2 }}>
          No matches met the configured threshold.
        </Alert>
      );
    }

    return (
      <TableContainer component={Paper} variant="outlined" sx={{ mt: 2 }}>
        <Table size="small" aria-label="match results">
          <TableHead>
            <TableRow>
              <TableCell>Label</TableCell>
              <TableCell>Dimension</TableCell>
              <TableCell>Score</TableCell>
              <TableCell>Description</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {matches.map((match) => (
              <TableRow key={match.canonical_id} hover>
                <TableCell width="25%">{match.canonical_label}</TableCell>
                <TableCell width="20%">{match.dimension}</TableCell>
                <TableCell width="15%">{(match.score * 100).toFixed(1)}%</TableCell>
                <TableCell>{match.description || '—'}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    );
  };

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline enableColorScheme />
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
          <Toolbar sx={{ gap: 3, alignItems: { xs: 'flex-start', sm: 'center' }, py: 2 }}>
            <Box sx={{ flexGrow: 1 }}>
              <Typography variant="h5" fontWeight={600} gutterBottom>
                RefData Hub
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Ship defaults instantly and route incremental changes through the reviewer UI.
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
            <FormControl size="small" sx={{ minWidth: 160 }}>
              <InputLabel id="theme-select-label">Theme</InputLabel>
              <Select
                labelId="theme-select-label"
                label="Theme"
                value={themeChoice}
                onChange={(event) => setThemeChoice(event.target.value as ThemeChoice)}
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
          </Toolbar>
        </AppBar>

        <Container maxWidth="lg" sx={{ py: { xs: 3, md: 5 } }}>
          {toast && (
            <Snackbar
              open
              autoHideDuration={6000}
              onClose={() => setToast(null)}
              anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
            >
              <Alert
                onClose={() => setToast(null)}
                severity={toast.type}
                variant="filled"
                sx={{ width: '100%' }}
              >
                {toast.content}
              </Alert>
            </Snackbar>
          )}

          {isLoading ? (
            <Paper elevation={0} variant="outlined" sx={{ p: 4, textAlign: 'center' }}>
              <CircularProgress size={32} sx={{ mb: 2 }} />
              <Typography variant="body1">Loading application state…</Typography>
            </Paper>
          ) : (
            <Stack spacing={4} component="main">
              <Paper variant="outlined" sx={{ p: { xs: 3, md: 4 } }}>
                <Stack spacing={2}>
                  <Box>
                    <Typography variant="h6" fontWeight={600} gutterBottom>
                      Runtime Configuration
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Updates persist instantly and drive the semantic matcher—no environment variables required.
                    </Typography>
                  </Box>
                  {config && (
                    <Grid container spacing={2} columns={{ xs: 1, sm: 6, md: 12 }}>
                      <Grid item xs={1} sm={3} md={6}>
                        <TextField
                          label="Default Dimension"
                          defaultValue={config.default_dimension}
                          fullWidth
                          onChange={(event) => handleConfigChange('default_dimension', event.target.value)}
                        />
                      </Grid>
                      <Grid item xs={1} sm={3} md={6}>
                        <TextField
                          label="Match Threshold"
                          type="number"
                          inputProps={{ step: 0.05, min: 0, max: 1 }}
                          defaultValue={config.match_threshold}
                          fullWidth
                          onChange={(event) => handleConfigChange('match_threshold', event.target.value)}
                        />
                      </Grid>
                      <Grid item xs={1} sm={3} md={6}>
                        <FormControl fullWidth>
                          <InputLabel id="matcher-backend-label">Matcher Backend</InputLabel>
                          <Select
                            labelId="matcher-backend-label"
                            label="Matcher Backend"
                            defaultValue={config.matcher_backend}
                            onChange={(event) => handleConfigChange('matcher_backend', event.target.value)}
                          >
                            {matcherOptions.map((option) => (
                              <MenuItem key={option.value} value={option.value}>
                                {option.label}
                              </MenuItem>
                            ))}
                          </Select>
                        </FormControl>
                      </Grid>
                      <Grid item xs={1} sm={3} md={6}>
                        <TextField
                          label="Embedding Model"
                          defaultValue={config.embedding_model}
                          fullWidth
                          onChange={(event) => handleConfigChange('embedding_model', event.target.value)}
                        />
                      </Grid>
                      <Grid item xs={1} sm={3} md={6}>
                        <TextField
                          label="LLM Model"
                          placeholder="gpt-4o-mini"
                          defaultValue={config.llm_model ?? ''}
                          fullWidth
                          onChange={(event) => handleConfigChange('llm_model', event.target.value)}
                        />
                      </Grid>
                      <Grid item xs={1} sm={3} md={6}>
                        <TextField
                          label="LLM API Base URL"
                          placeholder="https://api.openai.com/v1"
                          defaultValue={config.llm_api_base ?? ''}
                          fullWidth
                          onChange={(event) => handleConfigChange('llm_api_base', event.target.value)}
                        />
                      </Grid>
                      <Grid item xs={1} sm={3} md={6}>
                        <TextField
                          label="LLM API Key"
                          type="password"
                          placeholder={
                            config.llm_api_key_set ? 'Key already stored' : 'Paste secret key'
                          }
                          fullWidth
                          onChange={(event) => handleConfigChange('llm_api_key', event.target.value)}
                        />
                      </Grid>
                      <Grid item xs={1} sm={3} md={6}>
                        <TextField
                          label="Top K Results"
                          type="number"
                          inputProps={{ min: 1, max: 20 }}
                          defaultValue={config.top_k}
                          fullWidth
                          onChange={(event) => handleConfigChange('top_k', event.target.value)}
                        />
                      </Grid>
                    </Grid>
                  )}
                  <Box>
                    <Button
                      variant="contained"
                      onClick={() => void handleSaveConfig()}
                      disabled={savingConfig}
                      startIcon={<SaveRoundedIcon />}
                    >
                      {savingConfig ? 'Saving…' : 'Save Configuration'}
                    </Button>
                  </Box>
                </Stack>
              </Paper>

              <Paper variant="outlined" sx={{ p: { xs: 3, md: 4 } }}>
                <Stack spacing={3}>
                  <Box>
                    <Typography variant="h6" fontWeight={600} gutterBottom>
                      Semantic Match Playground
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Experiment with live inputs to see how the matcher responds across dimensions.
                    </Typography>
                  </Box>
                  <Box
                    component="form"
                    onSubmit={(event) => {
                      event.preventDefault();
                      void handleRunMatch();
                    }}
                  >
                    <Stack spacing={2}>
                      <TextField
                        label="Raw value"
                        placeholder="Enter a raw data value to match"
                        multiline
                        minRows={3}
                        value={matchInput}
                        onChange={(event) => setMatchInput(event.target.value)}
                        fullWidth
                      />
                      <FormControl fullWidth>
                        <InputLabel id="dimension-label">Dimension (optional)</InputLabel>
                        <Select
                          labelId="dimension-label"
                          label="Dimension (optional)"
                          value={matchDimension}
                          onChange={(event) => setMatchDimension(event.target.value)}
                        >
                          <MenuItem value="">Use default</MenuItem>
                          {availableDimensions.map((dimension) => (
                            <MenuItem key={dimension} value={dimension}>
                              {dimension}
                            </MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                      <Box>
                        <Button
                          type="submit"
                          variant="contained"
                          disabled={runningMatch}
                          startIcon={<PlayArrowRoundedIcon />}
                        >
                          {runningMatch ? 'Matching…' : 'Run Match'}
                        </Button>
                      </Box>
                    </Stack>
                  </Box>
                  {matchResults && (
                    <Box>
                      <Divider sx={{ mb: 2 }} />
                      <Typography variant="subtitle1" fontWeight={600}>
                        Matches for “{matchResults.raw_text}”
                      </Typography>
                      {renderMatches(matchResults.matches)}
                    </Box>
                  )}
                </Stack>
              </Paper>

              <Paper variant="outlined" sx={{ p: { xs: 3, md: 4 } }}>
                <Stack spacing={3}>
                  <Box>
                    <Typography variant="h6" fontWeight={600} gutterBottom>
                      Canonical Library
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Bootstrap reviewers with rich defaults and grow the knowledge base over time.
                    </Typography>
                  </Box>
                  <Box
                    component="form"
                    onSubmit={(event) => {
                      event.preventDefault();
                      void handleCreateCanonical();
                    }}
                  >
                    <Grid container spacing={2} columns={{ xs: 1, sm: 6, md: 12 }}>
                      <Grid item xs={1} sm={3} md={4}>
                        <TextField
                          label="Dimension"
                          value={newCanonical.dimension}
                          onChange={(event) =>
                            setNewCanonical((draft) => ({
                              ...draft,
                              dimension: event.target.value,
                            }))
                          }
                          fullWidth
                          required
                        />
                      </Grid>
                      <Grid item xs={1} sm={3} md={4}>
                        <TextField
                          label="Canonical Label"
                          value={newCanonical.canonical_label}
                          onChange={(event) =>
                            setNewCanonical((draft) => ({
                              ...draft,
                              canonical_label: event.target.value,
                            }))
                          }
                          fullWidth
                          required
                        />
                      </Grid>
                      <Grid item xs={1} sm={6} md={4}>
                        <TextField
                          label="Description (optional)"
                          value={newCanonical.description}
                          onChange={(event) =>
                            setNewCanonical((draft) => ({
                              ...draft,
                              description: event.target.value,
                            }))
                          }
                          fullWidth
                          multiline
                          minRows={2}
                        />
                      </Grid>
                      <Grid item xs={1} sm={6} md={12}>
                        <Button
                          type="submit"
                          variant="contained"
                          disabled={creatingCanonical}
                          startIcon={<AddCircleRoundedIcon />}
                        >
                          {creatingCanonical ? 'Adding…' : 'Add Canonical Value'}
                        </Button>
                      </Grid>
                    </Grid>
                  </Box>
                  <TableContainer component={Paper} variant="outlined">
                    <Table size="small" aria-label="canonical values">
                      <TableHead>
                        <TableRow>
                          <TableCell>Label</TableCell>
                          <TableCell>Dimension</TableCell>
                          <TableCell>Description</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {canonicalValues.map((value) => (
                          <TableRow key={`${value.dimension}-${value.id}`} hover>
                            <TableCell width="30%">{value.canonical_label}</TableCell>
                            <TableCell width="25%">{value.dimension}</TableCell>
                            <TableCell>{value.description || '—'}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </Stack>
              </Paper>
            </Stack>
          )}
        </Container>
      </Box>
    </ThemeProvider>
  );
};

export default App;
