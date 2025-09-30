import { useCallback, useEffect, useMemo, useState } from 'react';
import AddCircleRoundedIcon from '@mui/icons-material/AddCircleRounded';
import DeleteRoundedIcon from '@mui/icons-material/DeleteRounded';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import SaveRoundedIcon from '@mui/icons-material/SaveRounded';
import UploadRoundedIcon from '@mui/icons-material/UploadRounded';
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
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
  createFieldMapping,
  deleteFieldMapping,
  fetchFieldMappings,
  fetchSourceConnections,
  ingestSamples,
  updateFieldMapping,
} from '../api';
import { useAppState } from '../state/AppStateContext';
import type {
  SourceConnection,
  SourceFieldMapping,
  SourceFieldMappingPayload,
  SourceSampleValuePayload,
  ToastMessage,
} from '../types';

interface FieldMappingsPageProps {
  onToast: (toast: ToastMessage) => void;
}

const initialMapping: SourceFieldMappingPayload = {
  source_table: '',
  source_field: '',
  ref_dimension: '',
  description: '',
};

const FieldMappingsPage = ({ onToast }: FieldMappingsPageProps) => {
  const { canonicalValues } = useAppState();
  const [connections, setConnections] = useState<SourceConnection[]>([]);
  const [selectedConnectionId, setSelectedConnectionId] = useState<number | ''>('');
  const [mappings, setMappings] = useState<SourceFieldMapping[]>([]);
  const [loadingMappings, setLoadingMappings] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<SourceFieldMappingPayload>(initialMapping);
  const [editing, setEditing] = useState<SourceFieldMapping | null>(null);
  const [editForm, setEditForm] = useState<SourceFieldMappingPayload>(initialMapping);
  const [deleteTarget, setDeleteTarget] = useState<SourceFieldMapping | null>(null);
  const [sampleTable, setSampleTable] = useState('');
  const [sampleField, setSampleField] = useState('');
  const [sampleDimension, setSampleDimension] = useState('');
  const [sampleInput, setSampleInput] = useState('');
  const [ingesting, setIngesting] = useState(false);

  const availableDimensions = useMemo(() => {
    const set = new Set<string>();
    canonicalValues.forEach((value) => set.add(value.dimension));
    return Array.from(set).sort();
  }, [canonicalValues]);

  const loadConnections = useCallback(async () => {
    try {
      const records = await fetchSourceConnections();
      setConnections(records);
      if (!selectedConnectionId && records.length) {
        setSelectedConnectionId(records[0].id);
      }
    } catch (error) {
      console.error(error);
      onToast({ type: 'error', content: 'Failed to load connections' });
    }
  }, [onToast, selectedConnectionId]);

  const loadMappings = useCallback(async (connectionId: number) => {
    setLoadingMappings(true);
    try {
      const records = await fetchFieldMappings(connectionId);
      setMappings(records);
    } catch (error) {
      console.error(error);
      onToast({ type: 'error', content: 'Failed to load field mappings' });
    } finally {
      setLoadingMappings(false);
    }
  }, [onToast]);

  useEffect(() => {
    void loadConnections();
  }, [loadConnections]);

  useEffect(() => {
    if (selectedConnectionId) {
      void loadMappings(selectedConnectionId);
    } else {
      setMappings([]);
    }
  }, [selectedConnectionId, loadMappings]);

  const handleCreate = async () => {
    if (!selectedConnectionId) {
      onToast({ type: 'error', content: 'Select a connection first.' });
      return;
    }
    if (!form.source_table || !form.source_field || !form.ref_dimension) {
      onToast({ type: 'error', content: 'Provide table, field, and dimension.' });
      return;
    }
    setCreating(true);
    try {
      const created = await createFieldMapping(selectedConnectionId, form);
      setMappings((prev) => [...prev, created]);
      setForm(initialMapping);
      onToast({ type: 'success', content: 'Field mapping created' });
    } catch (error) {
      console.error(error);
      onToast({ type: 'error', content: 'Unable to create field mapping' });
    } finally {
      setCreating(false);
    }
  };

  const openEdit = (mapping: SourceFieldMapping) => {
    setEditing(mapping);
    setEditForm({
      source_table: mapping.source_table,
      source_field: mapping.source_field,
      ref_dimension: mapping.ref_dimension,
      description: mapping.description ?? '',
    });
  };

  const handleUpdate = async () => {
    if (!editing || !selectedConnectionId) return;
    try {
      const updated = await updateFieldMapping(selectedConnectionId, editing.id, editForm);
      setMappings((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
      onToast({ type: 'success', content: 'Field mapping updated' });
    } catch (error) {
      console.error(error);
      onToast({ type: 'error', content: 'Unable to update mapping' });
      return;
    } finally {
      setEditing(null);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget || !selectedConnectionId) return;
    try {
      await deleteFieldMapping(selectedConnectionId, deleteTarget.id);
      setMappings((prev) => prev.filter((item) => item.id !== deleteTarget.id));
      onToast({ type: 'success', content: 'Field mapping removed' });
    } catch (error) {
      console.error(error);
      onToast({ type: 'error', content: 'Unable to delete mapping' });
    } finally {
      setDeleteTarget(null);
    }
  };

  const parseSampleInput = (): SourceSampleValuePayload[] => {
    return sampleInput
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const [raw, count] = line.split(',');
        return {
          raw_value: raw.trim(),
          occurrence_count: count ? Number(count.trim()) || 1 : 1,
          dimension: sampleDimension || undefined,
        };
      });
  };

  const handleIngest = async () => {
    if (!selectedConnectionId) {
      onToast({ type: 'error', content: 'Select a connection first.' });
      return;
    }
    if (!sampleTable || !sampleField) {
      onToast({ type: 'error', content: 'Provide source table and field.' });
      return;
    }
    const values = parseSampleInput();
    if (!values.length) {
      onToast({ type: 'error', content: 'Provide at least one value.' });
      return;
    }
    setIngesting(true);
    try {
      await ingestSamples(selectedConnectionId, sampleTable, sampleField, values);
      onToast({ type: 'success', content: 'Sample values ingested' });
      setSampleInput('');
    } catch (error) {
      console.error(error);
      onToast({ type: 'error', content: 'Failed to ingest sample values' });
    } finally {
      setIngesting(false);
    }
  };

  return (
    <Stack spacing={4} component="section">
      <Paper variant="outlined" sx={{ p: { xs: 3, md: 4 } }}>
        <Stack spacing={2}>
          <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, gap: 2 }}>
            <Box sx={{ flexGrow: 1 }}>
              <Typography variant="h6" fontWeight={600} gutterBottom>
                Map source fields to reference dimensions
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Define which source fields feed each reference dataset. These mappings power downstream match statistics and reviewer workflows.
              </Typography>
            </Box>
            <FormControl size="small" sx={{ minWidth: 220 }}>
              <InputLabel id="connection-select-label">Connection</InputLabel>
              <Select
                labelId="connection-select-label"
                label="Connection"
                value={selectedConnectionId}
                onChange={(event) => setSelectedConnectionId(Number(event.target.value))}
              >
                {connections.map((connection) => (
                  <MenuItem key={connection.id} value={connection.id}>
                    {connection.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>

          <Grid container spacing={2} columns={{ xs: 1, sm: 6, md: 12 }}>
            <Grid item xs={1} sm={3} md={3}>
              <TextField
                label="Source table"
                value={form.source_table}
                onChange={(event) => setForm((prev) => ({ ...prev, source_table: event.target.value }))}
                fullWidth
                required
              />
            </Grid>
            <Grid item xs={1} sm={3} md={3}>
              <TextField
                label="Source field"
                value={form.source_field}
                onChange={(event) => setForm((prev) => ({ ...prev, source_field: event.target.value }))}
                fullWidth
                required
              />
            </Grid>
            <Grid item xs={1} sm={3} md={3}>
              <FormControl fullWidth>
                <InputLabel id="dimension-select-label">Reference dimension</InputLabel>
                <Select
                  labelId="dimension-select-label"
                  label="Reference dimension"
                  value={form.ref_dimension}
                  onChange={(event) => setForm((prev) => ({ ...prev, ref_dimension: event.target.value }))}
                >
                  {availableDimensions.map((dimension) => (
                    <MenuItem key={dimension} value={dimension}>
                      {dimension}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={1} sm={6} md={3}>
              <TextField
                label="Description"
                value={form.description ?? ''}
                onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))}
                fullWidth
              />
            </Grid>
            <Grid item xs={1} sm={6} md={12}>
              <Button
                variant="contained"
                startIcon={<AddCircleRoundedIcon />}
                disabled={creating || !selectedConnectionId}
                onClick={() => void handleCreate()}
              >
                {creating ? 'Creating…' : 'Create mapping'}
              </Button>
            </Grid>
          </Grid>
        </Stack>
      </Paper>

      <Paper variant="outlined" sx={{ p: { xs: 3, md: 4 } }}>
        <Typography variant="h6" fontWeight={600} gutterBottom>
          Configured field mappings
        </Typography>
        <Typography variant="body2" color="text.secondary" gutterBottom>
          Manage how source data flows into the reference data hub. These mappings drive sample ingestion, suggestions, and reconciliation insights.
        </Typography>
        <TableContainer>
          {loadingMappings ? (
            <Typography variant="body2" color="text.secondary" sx={{ p: 3 }}>
              Loading mappings…
            </Typography>
          ) : mappings.length ? (
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Table</TableCell>
                  <TableCell>Field</TableCell>
                  <TableCell>Dimension</TableCell>
                  <TableCell>Description</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {mappings.map((mapping) => (
                  <TableRow key={mapping.id} hover>
                    <TableCell>{mapping.source_table}</TableCell>
                    <TableCell>{mapping.source_field}</TableCell>
                    <TableCell>{mapping.ref_dimension}</TableCell>
                    <TableCell>{mapping.description || '—'}</TableCell>
                    <TableCell align="right">
                      <IconButton onClick={() => openEdit(mapping)} aria-label="Edit mapping">
                        <EditRoundedIcon fontSize="small" />
                      </IconButton>
                      <IconButton onClick={() => setDeleteTarget(mapping)} aria-label="Delete mapping">
                        <DeleteRoundedIcon fontSize="small" />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <Typography variant="body2" color="text.secondary" sx={{ p: 3 }}>
              No mappings defined yet. Add one above to get started.
            </Typography>
          )}
        </TableContainer>
      </Paper>

      <Paper variant="outlined" sx={{ p: { xs: 3, md: 4 } }}>
        <Stack spacing={2}>
          <Box>
            <Typography variant="h6" fontWeight={600} gutterBottom>
              Ingest sample values
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Paste raw values (optionally with counts) to simulate pulling data from the source. Each line accepts <code>value,count</code>.
            </Typography>
          </Box>
          <Grid container spacing={2} columns={{ xs: 1, sm: 6, md: 12 }}>
            <Grid item xs={1} sm={3} md={3}>
              <TextField
                label="Source table"
                value={sampleTable}
                onChange={(event) => setSampleTable(event.target.value)}
                fullWidth
              />
            </Grid>
            <Grid item xs={1} sm={3} md={3}>
              <TextField
                label="Source field"
                value={sampleField}
                onChange={(event) => setSampleField(event.target.value)}
                fullWidth
              />
            </Grid>
            <Grid item xs={1} sm={3} md={3}>
              <FormControl fullWidth>
                <InputLabel id="sample-dimension-label">Dimension (optional)</InputLabel>
                <Select
                  labelId="sample-dimension-label"
                  label="Dimension (optional)"
                  value={sampleDimension}
                  onChange={(event) => setSampleDimension(event.target.value)}
                >
                  <MenuItem value="">Auto-detect</MenuItem>
                  {availableDimensions.map((dimension) => (
                    <MenuItem key={dimension} value={dimension}>
                      {dimension}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={1} sm={6} md={12}>
              <TextField
                label="Raw values"
                value={sampleInput}
                onChange={(event) => setSampleInput(event.target.value)}
                fullWidth
                multiline
                minRows={4}
                placeholder={`Single
Married,12
Divorced,3`}
              />
            </Grid>
            <Grid item xs={1} sm={6} md={12}>
              <Button
                variant="contained"
                startIcon={<UploadRoundedIcon />}
                disabled={ingesting || !selectedConnectionId}
                onClick={() => void handleIngest()}
              >
                {ingesting ? 'Ingesting…' : 'Ingest sample values'}
              </Button>
            </Grid>
          </Grid>
        </Stack>
      </Paper>

      <Dialog open={Boolean(editing)} onClose={() => setEditing(null)} maxWidth="sm" fullWidth>
        <DialogTitle>Edit mapping</DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          <Stack spacing={2}>
            <TextField
              label="Source table"
              value={editForm.source_table}
              onChange={(event) => setEditForm((prev) => ({ ...prev, source_table: event.target.value }))}
              fullWidth
            />
            <TextField
              label="Source field"
              value={editForm.source_field}
              onChange={(event) => setEditForm((prev) => ({ ...prev, source_field: event.target.value }))}
              fullWidth
            />
            <FormControl fullWidth>
              <InputLabel id="edit-dimension-label">Reference dimension</InputLabel>
              <Select
                labelId="edit-dimension-label"
                label="Reference dimension"
                value={editForm.ref_dimension}
                onChange={(event) => setEditForm((prev) => ({ ...prev, ref_dimension: event.target.value }))}
              >
                {availableDimensions.map((dimension) => (
                  <MenuItem key={dimension} value={dimension}>
                    {dimension}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField
              label="Description"
              value={editForm.description ?? ''}
              onChange={(event) => setEditForm((prev) => ({ ...prev, description: event.target.value }))}
              fullWidth
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditing(null)}>Cancel</Button>
          <Button onClick={() => void handleUpdate()} variant="contained" startIcon={<SaveRoundedIcon />}>
            Save
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={Boolean(deleteTarget)} onClose={() => setDeleteTarget(null)}>
        <DialogTitle>Delete mapping</DialogTitle>
        <DialogContent>
          <Typography>
            Remove the mapping for “{deleteTarget?.source_table}.{deleteTarget?.source_field}”?
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteTarget(null)}>Cancel</Button>
          <Button color="error" onClick={() => void handleDelete()} startIcon={<DeleteRoundedIcon />}>
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
};

export default FieldMappingsPage;
