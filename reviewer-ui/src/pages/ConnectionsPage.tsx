import { useCallback, useEffect, useState } from 'react';
import DeleteRoundedIcon from '@mui/icons-material/DeleteRounded';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import AddCircleRoundedIcon from '@mui/icons-material/AddCircleRounded';
import SaveRoundedIcon from '@mui/icons-material/SaveRounded';
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,
  IconButton,
  Paper,
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
  createSourceConnection,
  deleteSourceConnection,
  fetchSourceConnections,
  updateSourceConnection,
} from '../api';
import type {
  SourceConnection,
  SourceConnectionCreatePayload,
  SourceConnectionUpdatePayload,
  ToastMessage,
} from '../types';

interface ConnectionsPageProps {
  onToast: (toast: ToastMessage) => void;
}

const emptyForm: SourceConnectionCreatePayload = {
  name: '',
  db_type: 'postgres',
  host: '',
  port: 5432,
  database: '',
  username: '',
  password: '',
  options: '',
};

const ConnectionsPage = ({ onToast }: ConnectionsPageProps) => {
  const [connections, setConnections] = useState<SourceConnection[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<SourceConnectionCreatePayload>(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [editing, setEditing] = useState<SourceConnection | null>(null);
  const [editForm, setEditForm] = useState<SourceConnectionUpdatePayload>({});
  const [deleteTarget, setDeleteTarget] = useState<SourceConnection | null>(null);

  const loadConnections = useCallback(async () => {
    setLoading(true);
    try {
      const records = await fetchSourceConnections();
      setConnections(records);
    } catch (error: unknown) {
      console.error(error);
      onToast({ type: 'error', content: 'Failed to load connections' });
    } finally {
      setLoading(false);
    }
  }, [onToast]);

  useEffect(() => {
    void loadConnections();
  }, [loadConnections]);

  const handleFormChange = (key: keyof SourceConnectionCreatePayload, value: string) => {
    setForm((prev) => ({ ...prev, [key]: key === 'port' ? Number(value) : value }));
  };

  const handleCreate = async () => {
    if (!form.name || !form.host || !form.database || !form.username) {
      onToast({ type: 'error', content: 'Fill in all required fields.' });
      return;
    }
    setSubmitting(true);
    try {
      const payload: SourceConnectionCreatePayload = {
        ...form,
        options: form.options ? form.options : undefined,
        password: form.password ? form.password : undefined,
      };
      const created = await createSourceConnection(payload);
      setConnections((prev) => [...prev, created]);
      setForm(emptyForm);
      onToast({ type: 'success', content: 'Connection added' });
    } catch (error: unknown) {
      console.error(error);
      onToast({ type: 'error', content: 'Unable to create connection' });
    } finally {
      setSubmitting(false);
    }
  };

  const openEdit = (connection: SourceConnection) => {
    setEditing(connection);
    setEditForm({
      name: connection.name,
      db_type: connection.db_type,
      host: connection.host,
      port: connection.port,
      database: connection.database,
      username: connection.username,
      options: connection.options ?? '',
      password: '',
    });
  };

  const handleUpdate = async () => {
    if (!editing) return;
    try {
      const payload: SourceConnectionUpdatePayload = {
        ...editForm,
        port: typeof editForm.port === 'string' ? Number(editForm.port) : editForm.port,
      };
      if (!payload.password) {
        delete payload.password;
      }
      if (payload.options === '') {
        payload.options = undefined;
      }
      const updated = await updateSourceConnection(editing.id, payload);
      setConnections((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
      onToast({ type: 'success', content: 'Connection updated' });
    } catch (error: unknown) {
      console.error(error);
      onToast({ type: 'error', content: 'Unable to update connection' });
      return;
    } finally {
      setEditing(null);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteSourceConnection(deleteTarget.id);
      setConnections((prev) => prev.filter((item) => item.id !== deleteTarget.id));
      onToast({ type: 'success', content: 'Connection removed' });
    } catch (error: unknown) {
      console.error(error);
      onToast({ type: 'error', content: 'Unable to delete connection' });
    } finally {
      setDeleteTarget(null);
    }
  };

  const renderConnectionTable = () => {
    if (!connections.length) {
      return (
        <Typography variant="body2" color="text.secondary" sx={{ p: 3 }}>
          No connections configured yet. Add one to start ingesting source data.
        </Typography>
      );
    }

    return (
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>Name</TableCell>
            <TableCell>Type</TableCell>
            <TableCell>Host</TableCell>
            <TableCell>Database</TableCell>
            <TableCell>User</TableCell>
            <TableCell>Updated</TableCell>
            <TableCell align="right">Actions</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {connections.map((connection) => (
            <TableRow key={connection.id} hover>
              <TableCell>{connection.name}</TableCell>
              <TableCell>{connection.db_type}</TableCell>
              <TableCell>{connection.host}:{connection.port}</TableCell>
              <TableCell>{connection.database}</TableCell>
              <TableCell>{connection.username}</TableCell>
              <TableCell>{new Date(connection.updated_at).toLocaleString()}</TableCell>
              <TableCell align="right">
                <IconButton onClick={() => openEdit(connection)} aria-label="Edit">
                  <EditRoundedIcon fontSize="small" />
                </IconButton>
                <IconButton onClick={() => setDeleteTarget(connection)} aria-label="Delete">
                  <DeleteRoundedIcon fontSize="small" />
                </IconButton>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    );
  };

  return (
    <Stack spacing={4} component="section">
      <Paper variant="outlined" sx={{ p: { xs: 3, md: 4 } }}>
        <Stack spacing={2}>
          <Box>
            <Typography variant="h6" fontWeight={600} gutterBottom>
              Register a source connection
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Connection metadata is stored securely and used for field mapping, sampling, and reconciliation.
            </Typography>
          </Box>
          <Grid container spacing={2} columns={{ xs: 1, sm: 6, md: 12 }}>
            <Grid item xs={1} sm={3} md={4}>
              <TextField
                label="Connection Name"
                value={form.name}
                onChange={(event) => handleFormChange('name', event.target.value)}
                fullWidth
                required
              />
            </Grid>
            <Grid item xs={1} sm={3} md={4}>
              <TextField
                label="Database Type"
                value={form.db_type}
                onChange={(event) => handleFormChange('db_type', event.target.value)}
                fullWidth
              />
            </Grid>
            <Grid item xs={1} sm={3} md={4}>
              <TextField
                label="Host"
                value={form.host}
                onChange={(event) => handleFormChange('host', event.target.value)}
                fullWidth
                required
              />
            </Grid>
            <Grid item xs={1} sm={3} md={4}>
              <TextField
                label="Port"
                type="number"
                value={form.port}
                onChange={(event) => handleFormChange('port', event.target.value)}
                fullWidth
              />
            </Grid>
            <Grid item xs={1} sm={3} md={4}>
              <TextField
                label="Database"
                value={form.database}
                onChange={(event) => handleFormChange('database', event.target.value)}
                fullWidth
                required
              />
            </Grid>
            <Grid item xs={1} sm={3} md={4}>
              <TextField
                label="Username"
                value={form.username}
                onChange={(event) => handleFormChange('username', event.target.value)}
                fullWidth
                required
              />
            </Grid>
            <Grid item xs={1} sm={3} md={4}>
              <TextField
                label="Password"
                type="password"
                value={form.password ?? ''}
                onChange={(event) => handleFormChange('password', event.target.value)}
                fullWidth
              />
            </Grid>
            <Grid item xs={1} sm={6} md={8}>
              <TextField
                label="Options (JSON)"
                value={form.options ?? ''}
                onChange={(event) => handleFormChange('options', event.target.value)}
                fullWidth
                placeholder='{"sslmode":"require"}'
              />
            </Grid>
            <Grid item xs={1} sm={6} md={12}>
              <Button
                variant="contained"
                startIcon={<AddCircleRoundedIcon />}
                disabled={submitting}
                onClick={() => void handleCreate()}
              >
                {submitting ? 'Adding…' : 'Add Connection'}
              </Button>
            </Grid>
          </Grid>
        </Stack>
      </Paper>

      <Paper variant="outlined" sx={{ p: { xs: 3, md: 4 } }}>
        <Typography variant="h6" fontWeight={600} gutterBottom>
          Source connections
        </Typography>
        <Typography variant="body2" color="text.secondary" gutterBottom>
          Edit or remove existing integrations. Deleting a connection removes associated field mappings, samples, and value mappings.
        </Typography>
        <TableContainer>
          {loading ? (
            <Typography variant="body2" color="text.secondary" sx={{ p: 3 }}>
              Loading connections…
            </Typography>
          ) : (
            renderConnectionTable()
          )}
        </TableContainer>
      </Paper>

      <Dialog open={Boolean(editing)} onClose={() => setEditing(null)} maxWidth="sm" fullWidth>
        <DialogTitle>Edit connection</DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          <Stack spacing={2}>
            <TextField
              label="Connection Name"
              value={editForm.name ?? ''}
              onChange={(event) => setEditForm((prev) => ({ ...prev, name: event.target.value }))}
              fullWidth
            />
            <TextField
              label="Database Type"
              value={editForm.db_type ?? ''}
              onChange={(event) => setEditForm((prev) => ({ ...prev, db_type: event.target.value }))}
              fullWidth
            />
            <TextField
              label="Host"
              value={editForm.host ?? ''}
              onChange={(event) => setEditForm((prev) => ({ ...prev, host: event.target.value }))}
              fullWidth
            />
            <TextField
              label="Port"
              type="number"
              value={editForm.port ?? ''}
              onChange={(event) => setEditForm((prev) => ({ ...prev, port: Number(event.target.value) }))}
              fullWidth
            />
            <TextField
              label="Database"
              value={editForm.database ?? ''}
              onChange={(event) => setEditForm((prev) => ({ ...prev, database: event.target.value }))}
              fullWidth
            />
            <TextField
              label="Username"
              value={editForm.username ?? ''}
              onChange={(event) => setEditForm((prev) => ({ ...prev, username: event.target.value }))}
              fullWidth
            />
            <TextField
              label="New Password"
              type="password"
              value={editForm.password ?? ''}
              onChange={(event) => setEditForm((prev) => ({ ...prev, password: event.target.value }))}
              fullWidth
              helperText="Leave blank to keep the current secret"
            />
            <TextField
              label="Options (JSON)"
              value={editForm.options ?? ''}
              onChange={(event) => setEditForm((prev) => ({ ...prev, options: event.target.value }))}
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
        <DialogTitle>Delete connection</DialogTitle>
        <DialogContent>
          <Typography>Remove the “{deleteTarget?.name}” connection and its related records?</Typography>
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

export default ConnectionsPage;
