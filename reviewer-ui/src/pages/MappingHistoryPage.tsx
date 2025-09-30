import { useCallback, useEffect, useMemo, useState } from 'react';
import DeleteRoundedIcon from '@mui/icons-material/DeleteRounded';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import SaveRoundedIcon from '@mui/icons-material/SaveRounded';
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
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
  deleteValueMapping,
  fetchAllValueMappings,
  fetchConnectionValueMappings,
  fetchSourceConnections,
  updateValueMapping,
} from '../api';
import { useAppState } from '../state/AppStateContext';
import type {
  CanonicalValue,
  SourceConnection,
  ToastMessage,
  ValueMappingExpanded,
  ValueMappingUpdatePayload,
} from '../types';

interface MappingHistoryPageProps {
  onToast: (toast: ToastMessage) => void;
}

const MappingHistoryPage = ({ onToast }: MappingHistoryPageProps) => {
  const { canonicalValues } = useAppState();
  const [connections, setConnections] = useState<SourceConnection[]>([]);
  const [selectedConnection, setSelectedConnection] = useState<number | 'all'>('all');
  const [mappings, setMappings] = useState<ValueMappingExpanded[]>([]);
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState<ValueMappingExpanded | null>(null);
  const [editForm, setEditForm] = useState<ValueMappingUpdatePayload>({});
  const [deleteTarget, setDeleteTarget] = useState<ValueMappingExpanded | null>(null);

  const canonicalByDimension = useMemo(() => {
    const map = new Map<string, CanonicalValue[]>();
    canonicalValues.forEach((value) => {
      const list = map.get(value.dimension) ?? [];
      list.push(value);
      map.set(value.dimension, list);
    });
    map.forEach((list) => list.sort((a, b) => a.canonical_label.localeCompare(b.canonical_label)));
    return map;
  }, [canonicalValues]);

  const loadConnections = useCallback(async () => {
    try {
      const records = await fetchSourceConnections();
      setConnections(records);
    } catch (error) {
      console.error(error);
      onToast({ type: 'error', content: 'Failed to load connections' });
    }
  }, [onToast]);

  const loadMappings = useCallback(async (connection: number | 'all') => {
    setLoading(true);
    try {
      const records = connection === 'all'
        ? await fetchAllValueMappings()
        : await fetchConnectionValueMappings(connection);
      setMappings(records);
    } catch (error) {
      console.error(error);
      onToast({ type: 'error', content: 'Unable to load value mappings' });
    } finally {
      setLoading(false);
    }
  }, [onToast]);

  useEffect(() => {
    void loadConnections();
  }, [loadConnections]);

  useEffect(() => {
    void loadMappings(selectedConnection);
  }, [selectedConnection, loadMappings]);

  const openEdit = (mapping: ValueMappingExpanded) => {
    setEditing(mapping);
    setEditForm({
      canonical_id: mapping.canonical_id,
      status: mapping.status,
      confidence: mapping.confidence ?? undefined,
      notes: mapping.notes ?? '',
    });
  };

  const handleUpdate = async () => {
    if (!editing) return;
    try {
      const payload: ValueMappingUpdatePayload = {
        ...editForm,
        confidence:
          typeof editForm.confidence === 'number' ? editForm.confidence : undefined,
        notes: editForm.notes === '' ? undefined : editForm.notes,
      };
      const updated = await updateValueMapping(editing.source_connection_id, editing.id, payload);
      const canonical = canonicalValues.find((value) => value.id === updated.canonical_id);
      setMappings((prev) =>
        prev.map((item) =>
          item.id === updated.id
            ? {
                ...item,
                canonical_id: updated.canonical_id,
                status: updated.status,
                confidence: updated.confidence ?? undefined,
                suggested_label: updated.suggested_label ?? undefined,
                notes: updated.notes ?? undefined,
                updated_at: updated.updated_at,
                canonical_label: canonical?.canonical_label ?? item.canonical_label,
                ref_dimension: canonical?.dimension ?? item.ref_dimension,
              }
            : item,
        ),
      );
      onToast({ type: 'success', content: 'Mapping updated' });
    } catch (error) {
      console.error(error);
      onToast({ type: 'error', content: 'Unable to update mapping' });
      return;
    } finally {
      setEditing(null);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteValueMapping(deleteTarget.source_connection_id, deleteTarget.id);
      setMappings((prev) => prev.filter((item) => item.id !== deleteTarget.id));
      onToast({ type: 'success', content: 'Mapping deleted' });
    } catch (error) {
      console.error(error);
      onToast({ type: 'error', content: 'Unable to delete mapping' });
    } finally {
      setDeleteTarget(null);
    }
  };

  return (
    <Stack spacing={4} component="section">
      <Paper variant="outlined" sx={{ p: { xs: 3, md: 4 } }}>
        <Stack spacing={2}>
          <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, gap: 2 }}>
            <Box sx={{ flexGrow: 1 }}>
              <Typography variant="h6" fontWeight={600} gutterBottom>
                Mapping history
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Review every approved mapping across your reference datasets. Update or retire mappings as source systems evolve.
              </Typography>
            </Box>
            <FormControl size="small" sx={{ minWidth: 220 }}>
              <InputLabel id="history-connection-label">Connection</InputLabel>
              <Select
                labelId="history-connection-label"
                label="Connection"
                value={selectedConnection}
                onChange={(event) => {
                  const value = event.target.value;
                  setSelectedConnection(value === 'all' ? 'all' : Number(value));
                }}
              >
                <MenuItem value="all">All connections</MenuItem>
                {connections.map((connection) => (
                  <MenuItem key={connection.id} value={connection.id}>
                    {connection.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>
          {loading && <Typography variant="body2">Loading mappings…</Typography>}
        </Stack>
      </Paper>

      <Paper variant="outlined" sx={{ p: { xs: 0 } }}>
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Connection</TableCell>
                <TableCell>Source</TableCell>
                <TableCell>Canonical value</TableCell>
                <TableCell>Dimension</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Confidence</TableCell>
                <TableCell>Updated</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {mappings.map((mapping) => (
                <TableRow key={mapping.id} hover>
                  <TableCell>
                    {connections.find((conn) => conn.id === mapping.source_connection_id)?.name || mapping.source_connection_id}
                  </TableCell>
                  <TableCell>{mapping.source_table}.{mapping.source_field}</TableCell>
                  <TableCell>{mapping.canonical_label}</TableCell>
                  <TableCell>{mapping.ref_dimension}</TableCell>
                  <TableCell>{mapping.status}</TableCell>
                  <TableCell>{mapping.confidence != null ? `${(mapping.confidence * 100).toFixed(0)}%` : '—'}</TableCell>
                  <TableCell>{new Date(mapping.updated_at).toLocaleString()}</TableCell>
                  <TableCell align="right">
                    <Button size="small" startIcon={<EditRoundedIcon fontSize="small" />} onClick={() => openEdit(mapping)}>
                      Edit
                    </Button>
                    <Button
                      size="small"
                      color="error"
                      startIcon={<DeleteRoundedIcon fontSize="small" />}
                      onClick={() => setDeleteTarget(mapping)}
                    >
                      Delete
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {!mappings.length && !loading && (
                <TableRow>
                  <TableCell colSpan={8} align="center">
                    <Typography variant="body2" color="text.secondary">
                      No mappings recorded yet.
                    </Typography>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      <Dialog open={Boolean(editing)} onClose={() => setEditing(null)} maxWidth="sm" fullWidth>
        <DialogTitle>Edit mapping</DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          <Stack spacing={2}>
            <FormControl fullWidth>
              <InputLabel id="edit-canonical-label">Canonical value</InputLabel>
              <Select
                labelId="edit-canonical-label"
                label="Canonical value"
                value={editForm.canonical_id ?? ''}
                onChange={(event) => setEditForm((prev) => ({ ...prev, canonical_id: Number(event.target.value) }))}
              >
                {editing &&
                  (canonicalByDimension.get(editing.ref_dimension) ?? []).map((canonical) => (
                    <MenuItem key={canonical.id} value={canonical.id}>
                      {canonical.canonical_label}
                    </MenuItem>
                  ))}
              </Select>
            </FormControl>
            <FormControl fullWidth>
              <InputLabel id="edit-status-label">Status</InputLabel>
              <Select
                labelId="edit-status-label"
                label="Status"
                value={editForm.status ?? 'approved'}
                onChange={(event) => setEditForm((prev) => ({ ...prev, status: event.target.value }))}
              >
                <MenuItem value="approved">Approved</MenuItem>
                <MenuItem value="pending">Pending</MenuItem>
                <MenuItem value="retired">Retired</MenuItem>
              </Select>
            </FormControl>
            <TextField
              label="Confidence (0-1)"
              type="number"
              inputProps={{ min: 0, max: 1, step: 0.05 }}
              value={editForm.confidence ?? ''}
              onChange={(event) => setEditForm((prev) => ({ ...prev, confidence: event.target.value === '' ? undefined : Number(event.target.value) }))}
              fullWidth
            />
            <TextField
              label="Notes"
              value={editForm.notes ?? ''}
              onChange={(event) => setEditForm((prev) => ({ ...prev, notes: event.target.value }))}
              fullWidth
              multiline
              minRows={3}
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
            Remove the mapping for “{deleteTarget?.raw_value}” from {deleteTarget?.source_table}.{deleteTarget?.source_field}?
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

export default MappingHistoryPage;
