import { useMemo, useState } from 'react';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import DeleteRoundedIcon from '@mui/icons-material/DeleteRounded';
import SaveRoundedIcon from '@mui/icons-material/SaveRounded';
import PlayArrowRoundedIcon from '@mui/icons-material/PlayArrowRounded';
import AddCircleRoundedIcon from '@mui/icons-material/AddCircleRounded';
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  Grid,
  IconButton,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';

import {
  createCanonicalValue,
  deleteCanonicalValue,
  proposeMatch,
  updateCanonicalValue,
  updateConfig,
} from '../api';
import { useAppState } from '../state/AppStateContext';
import type {
  CanonicalValue,
  CanonicalValueUpdatePayload,
  MatchCandidate,
  MatchResponse,
  ToastMessage,
} from '../types';

interface DashboardPageProps {
  onToast: (toast: ToastMessage) => void;
}

const DashboardPage = ({ onToast }: DashboardPageProps) => {
  const { config, setConfig, canonicalValues, updateCanonicalValues, isLoading } = useAppState();
  const [configDraft, setConfigDraft] = useState<Record<string, string>>({});
  const [savingConfig, setSavingConfig] = useState(false);
  const [matchInput, setMatchInput] = useState('');
  const [matchDimension, setMatchDimension] = useState('');
  const [matchResults, setMatchResults] = useState<MatchResponse | null>(null);
  const [runningMatch, setRunningMatch] = useState(false);
  const [creatingCanonical, setCreatingCanonical] = useState(false);
  const [newCanonical, setNewCanonical] = useState<CanonicalValueUpdatePayload>({
    dimension: '',
    canonical_label: '',
    description: '',
  });
  const [editingCanonical, setEditingCanonical] = useState<CanonicalValue | null>(null);
  const [editDraft, setEditDraft] = useState<CanonicalValueUpdatePayload>({});
  const [deleteTarget, setDeleteTarget] = useState<CanonicalValue | null>(null);

  const availableDimensions = useMemo(() => {
    const dimensionSet = new Set<string>();
    canonicalValues.forEach((value) => dimensionSet.add(value.dimension));
    if (config?.default_dimension) {
      dimensionSet.add(config.default_dimension);
    }
    return Array.from(dimensionSet).sort();
  }, [canonicalValues, config?.default_dimension]);

  const handleConfigChange = (key: string, value: string) => {
    setConfigDraft((draft) => ({ ...draft, [key]: value }));
  };

  const handleSaveConfig = async () => {
    if (!config) return;
    setSavingConfig(true);
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
      setConfig(() => updated);
      setConfigDraft({});
      onToast({ type: 'success', content: 'Configuration updated' });
    } catch (error: unknown) {
      console.error(error);
      onToast({ type: 'error', content: 'Unable to update configuration' });
    } finally {
      setSavingConfig(false);
    }
  };

  const handleRunMatch = async () => {
    if (!matchInput.trim()) {
      onToast({ type: 'error', content: 'Enter a raw value to match.' });
      return;
    }
    setRunningMatch(true);
    try {
      const response = await proposeMatch(matchInput.trim(), matchDimension || undefined);
      setMatchResults(response);
    } catch (error: unknown) {
      console.error(error);
      onToast({ type: 'error', content: 'Matching request failed' });
    } finally {
      setRunningMatch(false);
    }
  };

  const handleCreateCanonical = async () => {
    if (!newCanonical.dimension || !newCanonical.canonical_label) {
      onToast({ type: 'error', content: 'Provide both dimension and label.' });
      return;
    }
    setCreatingCanonical(true);
    try {
      const created = await createCanonicalValue(newCanonical);
      updateCanonicalValues((values) => [...values, created]);
      setNewCanonical({ dimension: '', canonical_label: '', description: '' });
      onToast({ type: 'success', content: 'Canonical value added' });
    } catch (error: unknown) {
      console.error(error);
      onToast({ type: 'error', content: 'Failed to add canonical value' });
    } finally {
      setCreatingCanonical(false);
    }
  };

  const openEditDialog = (value: CanonicalValue) => {
    setEditingCanonical(value);
    setEditDraft({
      dimension: value.dimension,
      canonical_label: value.canonical_label,
      description: value.description ?? '',
    });
  };

  const handleUpdateCanonical = async () => {
    if (!editingCanonical) return;
    try {
      const updated = await updateCanonicalValue(editingCanonical.id, editDraft);
      updateCanonicalValues((values) =>
        values.map((item) => (item.id === updated.id ? updated : item)),
      );
      onToast({ type: 'success', content: 'Canonical value updated' });
    } catch (error: unknown) {
      console.error(error);
      onToast({ type: 'error', content: 'Unable to update canonical value' });
      return;
    } finally {
      setEditingCanonical(null);
    }
  };

  const handleDeleteCanonical = async () => {
    if (!deleteTarget) return;
    try {
      await deleteCanonicalValue(deleteTarget.id);
      updateCanonicalValues((values) => values.filter((item) => item.id !== deleteTarget.id));
      onToast({ type: 'success', content: 'Canonical value removed' });
    } catch (error: unknown) {
      console.error(error);
      onToast({ type: 'error', content: 'Unable to delete canonical value' });
    } finally {
      setDeleteTarget(null);
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

  if (isLoading) {
    return (
      <Paper elevation={0} variant="outlined" sx={{ p: 4, textAlign: 'center' }}>
        <Typography variant="body1">Loading application state…</Typography>
      </Paper>
    );
  }

  return (
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
                    <MenuItem value="embedding">Embedding based (default)</MenuItem>
                    <MenuItem value="llm">LLM orchestration</MenuItem>
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
                  value={newCanonical.dimension ?? ''}
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
                  value={newCanonical.canonical_label ?? ''}
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
                  value={newCanonical.description ?? ''}
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
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {canonicalValues.map((value) => (
                  <TableRow key={`${value.dimension}-${value.id}`} hover>
                    <TableCell width="30%">{value.canonical_label}</TableCell>
                    <TableCell width="25%">{value.dimension}</TableCell>
                    <TableCell>{value.description || '—'}</TableCell>
                    <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                      <IconButton aria-label="Edit" onClick={() => openEditDialog(value)}>
                        <EditRoundedIcon fontSize="small" />
                      </IconButton>
                      <IconButton aria-label="Delete" onClick={() => setDeleteTarget(value)}>
                        <DeleteRoundedIcon fontSize="small" />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Stack>
      </Paper>

      <Dialog open={Boolean(editingCanonical)} onClose={() => setEditingCanonical(null)} maxWidth="sm" fullWidth>
        <DialogTitle>Edit canonical value</DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          <Stack spacing={2}>
            <TextField
              label="Dimension"
              value={editDraft.dimension ?? ''}
              onChange={(event) => setEditDraft((draft) => ({ ...draft, dimension: event.target.value }))}
              fullWidth
            />
            <TextField
              label="Canonical Label"
              value={editDraft.canonical_label ?? ''}
              onChange={(event) => setEditDraft((draft) => ({ ...draft, canonical_label: event.target.value }))}
              fullWidth
            />
            <TextField
              label="Description"
              value={editDraft.description ?? ''}
              onChange={(event) => setEditDraft((draft) => ({ ...draft, description: event.target.value }))}
              fullWidth
              multiline
              minRows={3}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditingCanonical(null)}>Cancel</Button>
          <Button onClick={() => void handleUpdateCanonical()} variant="contained" startIcon={<SaveRoundedIcon />}>
            Save
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={Boolean(deleteTarget)} onClose={() => setDeleteTarget(null)}>
        <DialogTitle>Remove canonical value</DialogTitle>
        <DialogContent>
          <Typography>
            Delete “{deleteTarget?.canonical_label}” from the {deleteTarget?.dimension} dimension?
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteTarget(null)}>Cancel</Button>
          <Button color="error" onClick={() => void handleDeleteCanonical()} startIcon={<DeleteRoundedIcon />}>
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
};

export default DashboardPage;
