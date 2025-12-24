import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import {
  createSourceConnection,
  deleteSourceConnection,
  fetchSourceConnections,
  testExistingSourceConnection,
  testSourceConnection,
  updateSourceConnection,
} from '../api';
import type {
  SourceConnection,
  SourceConnectionCreatePayload,
  SourceConnectionUpdatePayload,
  SourceConnectionTestResult,
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

const formatLatencyLabel = (latency?: number | null): string | null => {
  if (latency === undefined || latency === null) {
    return null;
  }
  if (latency >= 1) {
    return `${Math.round(latency)} ms`;
  }
  if (latency > 0) {
    return `${latency.toFixed(2)} ms`;
  }
  return null;
};

const formatTestToast = (result: SourceConnectionTestResult, connectionName?: string): string => {
  const base = result.message || 'Connection succeeded.';
  const latency = formatLatencyLabel(result.latency_ms);
  const message = latency ? `${base} (${latency})` : base;
  return connectionName ? `${connectionName}: ${message}` : message;
};

const resolveErrorMessage = (error: unknown, fallback: string): string => {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return fallback;
};

const ConnectionsPage = ({ onToast }: ConnectionsPageProps) => {
  const [connections, setConnections] = useState<SourceConnection[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<SourceConnectionCreatePayload>(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [editing, setEditing] = useState<SourceConnection | null>(null);
  const [editForm, setEditForm] = useState<SourceConnectionUpdatePayload>({});
  const [deleteTarget, setDeleteTarget] = useState<SourceConnection | null>(null);
  const [testingNewConnection, setTestingNewConnection] = useState(false);
  const [testingExistingId, setTestingExistingId] = useState<number | null>(null);

  const loadConnections = useCallback(async () => {
    setLoading(true);
    try {
      const records = await fetchSourceConnections();
      setConnections(records);
    } catch (error: unknown) {
      console.error(error);
      onToast({ type: 'error', content: 'Failed to load connections.' });
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

  const handleTestNewConnection = async () => {
    if (!form.host || !form.database || !form.username) {
      onToast({ type: 'error', content: 'Provide host, database, and username before testing.' });
      return;
    }

    setTestingNewConnection(true);
    try {
      const payload = {
        ...form,
        options: form.options ? form.options : undefined,
        password: form.password ? form.password : undefined,
      };
      const result = await testSourceConnection(payload);
      onToast({
        type: 'success',
        content: formatTestToast(result, form.name || undefined),
      });
    } catch (error: unknown) {
      console.error(error);
      onToast({
        type: 'error',
        content: resolveErrorMessage(error, 'Unable to test connection.'),
      });
    } finally {
      setTestingNewConnection(false);
    }
  };

  const handleTestExistingConnection = async (
    connectionId: number,
    overrides?: SourceConnectionUpdatePayload,
  ) => {
    setTestingExistingId(connectionId);
    try {
      const result = await testExistingSourceConnection(connectionId, overrides);
      const connectionName = connections.find((item) => item.id === connectionId)?.name;
      onToast({
        type: 'success',
        content: formatTestToast(result, connectionName),
      });
    } catch (error: unknown) {
      console.error(error);
      onToast({
        type: 'error',
        content: resolveErrorMessage(error, 'Unable to test connection.'),
      });
    } finally {
      setTestingExistingId(null);
    }
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
      setForm({ ...emptyForm });
      onToast({ type: 'success', content: 'Connection added.' });
    } catch (error: unknown) {
      console.error(error);
      onToast({ type: 'error', content: 'Unable to create connection.' });
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

  const handleEditChange = (key: keyof SourceConnectionUpdatePayload, value: string) => {
    setEditForm((prev) => ({ ...prev, [key]: key === 'port' ? Number(value) : value }));
  };

  const handleUpdate = async () => {
    if (!editing) return;
    setSubmitting(true);
    try {
      const payload: SourceConnectionUpdatePayload = {
        ...editForm,
        options: editForm.options ? editForm.options : undefined,
        password: editForm.password ? editForm.password : undefined,
      };
      const updated = await updateSourceConnection(editing.id, payload);
      setConnections((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
      setEditing(null);
      onToast({ type: 'success', content: 'Connection updated.' });
    } catch (error: unknown) {
      console.error(error);
      onToast({ type: 'error', content: 'Unable to update connection.' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setSubmitting(true);
    try {
      await deleteSourceConnection(deleteTarget.id);
      setConnections((prev) => prev.filter((item) => item.id !== deleteTarget.id));
      onToast({ type: 'success', content: 'Connection deleted.' });
      setDeleteTarget(null);
    } catch (error: unknown) {
      console.error(error);
      onToast({ type: 'error', content: 'Unable to delete connection.' });
    } finally {
      setSubmitting(false);
    }
  };

  const sortedConnections = useMemo(
    () => [...connections].sort((a, b) => a.name.localeCompare(b.name)),
    [connections],
  );

  return (
    <Fragment>
      <div className="flex flex-col gap-8">
        <section className="surface-card flex flex-col gap-6">
          <div className="space-y-2">
            <h1 className="section-heading text-2xl">Register a source connection</h1>
            <p className="text-sm text-slate-400">
              Store connection metadata for sampling, mapping, and reconciliation workflows.
            </p>
          </div>

          <form
            onSubmit={(event) => {
              event.preventDefault();
              void handleCreate();
            }}
            className="grid gap-4 lg:grid-cols-4"
          >
            <label htmlFor="connection-name" className="flex flex-col gap-2">
              <span className="text-xs font-semibold uppercase tracking-[0.35em] text-slate-400">Connection name</span>
              <input
                id="connection-name"
                value={form.name}
                onChange={(event) => handleFormChange('name', event.target.value)}
                required
              />
            </label>
            <label htmlFor="connection-type" className="flex flex-col gap-2">
              <span className="text-xs font-semibold uppercase tracking-[0.35em] text-slate-400">Database type</span>
              <input
                id="connection-type"
                value={form.db_type}
                onChange={(event) => handleFormChange('db_type', event.target.value)}
              />
            </label>
            <label htmlFor="connection-host" className="flex flex-col gap-2">
              <span className="text-xs font-semibold uppercase tracking-[0.35em] text-slate-400">Host</span>
              <input
                id="connection-host"
                value={form.host}
                onChange={(event) => handleFormChange('host', event.target.value)}
                required
              />
            </label>
            <label htmlFor="connection-port" className="flex flex-col gap-2">
              <span className="text-xs font-semibold uppercase tracking-[0.35em] text-slate-400">Port</span>
              <input
                id="connection-port"
                type="number"
                value={form.port}
                onChange={(event) => handleFormChange('port', event.target.value)}
              />
            </label>
            <label htmlFor="connection-database" className="flex flex-col gap-2">
              <span className="text-xs font-semibold uppercase tracking-[0.35em] text-slate-400">Database</span>
              <input
                id="connection-database"
                value={form.database}
                onChange={(event) => handleFormChange('database', event.target.value)}
                required
              />
            </label>
            <label htmlFor="connection-username" className="flex flex-col gap-2">
              <span className="text-xs font-semibold uppercase tracking-[0.35em] text-slate-400">Username</span>
              <input
                id="connection-username"
                value={form.username}
                onChange={(event) => handleFormChange('username', event.target.value)}
                required
              />
            </label>
            <label htmlFor="connection-password" className="flex flex-col gap-2">
              <span className="text-xs font-semibold uppercase tracking-[0.35em] text-slate-400">Password</span>
              <input
                id="connection-password"
                type="password"
                value={form.password ?? ''}
                onChange={(event) => handleFormChange('password', event.target.value)}
              />
            </label>
            <label htmlFor="connection-options" className="flex flex-col gap-2 lg:col-span-4">
              <span className="text-xs font-semibold uppercase tracking-[0.35em] text-slate-400">Options (JSON)</span>
              <input
                id="connection-options"
                placeholder='{"sslmode":"require"}'
                value={form.options ?? ''}
                onChange={(event) => handleFormChange('options', event.target.value)}
              />
            </label>
            <div className="flex flex-col gap-2 lg:col-span-4 lg:flex-row lg:justify-end">
              <button
                type="button"
                className="button-secondary"
                onClick={() => void handleTestNewConnection()}
                disabled={testingNewConnection || submitting}
              >
                {testingNewConnection ? (
                  <span className="flex items-center gap-2">
                    <span
                      className="h-4 w-4 animate-spin rounded-full border-2 border-aurora/40 border-t-aurora"
                      aria-hidden="true"
                    />
                    Testing…
                  </span>
                ) : (
                  'Test connection'
                )}
              </button>
              <button type="submit" className="button-primary" disabled={submitting || testingNewConnection}>
                {submitting ? (
                  <span className="flex items-center gap-2">
                    <span
                      className="h-4 w-4 animate-spin rounded-full border-2 border-aurora/40 border-t-aurora"
                      aria-hidden="true"
                    />
                    Adding…
                  </span>
                ) : (
                  'Add connection'
                )}
              </button>
            </div>
          </form>
        </section>

        <section className="surface-card flex flex-col gap-4">
          <div className="space-y-2">
            <h2 className="section-heading text-xl">Source connections</h2>
            <p className="text-sm text-slate-400">
              Edit or remove existing integrations. Deleting a connection removes associated mappings and samples.
            </p>
          </div>
          <div className="overflow-hidden rounded-3xl border border-slate-800/70">
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th className="px-4 py-3 text-left">Name</th>
                    <th className="px-4 py-3 text-left">Database</th>
                    <th className="px-4 py-3 text-left">Host</th>
                    <th className="px-4 py-3 text-left">Updated</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loading && (
                    <tr>
                      <td colSpan={5} className="px-4 py-6 text-center text-sm text-slate-400">
                        Loading connections…
                      </td>
                    </tr>
                  )}
                  {!loading && sortedConnections.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-4 py-6 text-center text-sm text-slate-400">
                        No connections registered yet.
                      </td>
                    </tr>
                  )}
                  {!loading &&
                    sortedConnections.map((connection) => (
                      <tr key={connection.id} className="bg-slate-900/40">
                        <td className="px-4 py-3 font-semibold text-slate-100">{connection.name}</td>
                        <td className="px-4 py-3 text-slate-300">{connection.database}</td>
                        <td className="px-4 py-3 text-slate-300">{connection.host}</td>
                        <td className="px-4 py-3 text-sm text-slate-400">
                          {new Date(connection.updated_at).toLocaleString()}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap justify-end gap-2">
                            <Link to={`/connections/${connection.id}`} className="button-primary text-xs">
                              View
                            </Link>
                            <button
                              type="button"
                              className="button-secondary text-xs"
                              onClick={() => void handleTestExistingConnection(connection.id)}
                              disabled={testingExistingId === connection.id}
                            >
                              {testingExistingId === connection.id ? (
                                <span className="flex items-center gap-2">
                                  <span
                                    className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-aurora/40 border-t-aurora"
                                    aria-hidden="true"
                                  />
                                  Testing…
                                </span>
                              ) : (
                                'Test'
                              )}
                            </button>
                            <button
                              type="button"
                              className="button-secondary text-xs"
                              onClick={() => openEdit(connection)}
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              className="button-danger text-xs"
                              onClick={() => setDeleteTarget(connection)}
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      </div>

      {editing && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="edit-connection-title">
          <div className="modal-panel relative">
            <h3 id="edit-connection-title" className="modal-title">
              Edit connection
            </h3>
            <button type="button" className="modal-close" onClick={() => setEditing(null)} aria-label="Close dialog">
              ×
            </button>
            <form className="mt-4 grid gap-4 lg:grid-cols-2">
              <label htmlFor="edit-name" className="flex flex-col gap-2">
                <span className="text-xs font-semibold uppercase tracking-[0.35em] text-slate-400">Name</span>
                <input
                  id="edit-name"
                  value={editForm.name ?? ''}
                  onChange={(event) => handleEditChange('name', event.target.value)}
                />
              </label>
              <label htmlFor="edit-db-type" className="flex flex-col gap-2">
                <span className="text-xs font-semibold uppercase tracking-[0.35em] text-slate-400">Database type</span>
                <input
                  id="edit-db-type"
                  value={editForm.db_type ?? ''}
                  onChange={(event) => handleEditChange('db_type', event.target.value)}
                />
              </label>
              <label htmlFor="edit-host" className="flex flex-col gap-2">
                <span className="text-xs font-semibold uppercase tracking-[0.35em] text-slate-400">Host</span>
                <input
                  id="edit-host"
                  value={editForm.host ?? ''}
                  onChange={(event) => handleEditChange('host', event.target.value)}
                />
              </label>
              <label htmlFor="edit-port" className="flex flex-col gap-2">
                <span className="text-xs font-semibold uppercase tracking-[0.35em] text-slate-400">Port</span>
                <input
                  id="edit-port"
                  type="number"
                  value={editForm.port ?? 0}
                  onChange={(event) => handleEditChange('port', event.target.value)}
                />
              </label>
              <label htmlFor="edit-database" className="flex flex-col gap-2">
                <span className="text-xs font-semibold uppercase tracking-[0.35em] text-slate-400">Database</span>
                <input
                  id="edit-database"
                  value={editForm.database ?? ''}
                  onChange={(event) => handleEditChange('database', event.target.value)}
                />
              </label>
              <label htmlFor="edit-username" className="flex flex-col gap-2">
                <span className="text-xs font-semibold uppercase tracking-[0.35em] text-slate-400">Username</span>
                <input
                  id="edit-username"
                  value={editForm.username ?? ''}
                  onChange={(event) => handleEditChange('username', event.target.value)}
                />
              </label>
              <label htmlFor="edit-password" className="flex flex-col gap-2">
                <span className="text-xs font-semibold uppercase tracking-[0.35em] text-slate-400">Password</span>
                <input
                  id="edit-password"
                  type="password"
                  value={editForm.password ?? ''}
                  onChange={(event) => handleEditChange('password', event.target.value)}
                />
              </label>
              <label htmlFor="edit-options" className="flex flex-col gap-2 lg:col-span-2">
                <span className="text-xs font-semibold uppercase tracking-[0.35em] text-slate-400">Options</span>
                <input
                  id="edit-options"
                  value={editForm.options ?? ''}
                  onChange={(event) => handleEditChange('options', event.target.value)}
                />
              </label>
            </form>
            <div className="modal-actions">
              <button
                type="button"
                className="button-secondary"
                onClick={() => setEditing(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="button-secondary"
                onClick={() => editing && void handleTestExistingConnection(editing.id, editForm)}
                disabled={!editing || testingExistingId === editing.id}
              >
                {editing && testingExistingId === editing.id ? (
                  <span className="flex items-center gap-2">
                    <span
                      className="h-4 w-4 animate-spin rounded-full border-2 border-aurora/40 border-t-aurora"
                      aria-hidden="true"
                    />
                    Testing…
                  </span>
                ) : (
                  'Test connection'
                )}
              </button>
              <button
                type="button"
                className="button-primary"
                onClick={() => void handleUpdate()}
                disabled={submitting}
              >
                {submitting ? (
                  <span className="flex items-center gap-2">
                    <span
                      className="h-4 w-4 animate-spin rounded-full border-2 border-aurora/40 border-t-aurora"
                      aria-hidden="true"
                    />
                    Saving…
                  </span>
                ) : (
                  'Save changes'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteTarget && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="delete-connection-title">
          <div className="modal-panel relative">
            <h3 id="delete-connection-title" className="modal-title">
              Delete connection
            </h3>
            <button
              type="button"
              className="modal-close"
              onClick={() => setDeleteTarget(null)}
              aria-label="Close dialog"
            >
              ×
            </button>
            <p className="mt-4 text-sm text-slate-300">
              Delete “{deleteTarget.name}”? Associated mappings, samples, and value mappings will also be removed.
            </p>
            <div className="modal-actions">
              <button
                type="button"
                className="button-secondary"
                onClick={() => setDeleteTarget(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="button-danger"
                onClick={() => void handleDelete()}
                disabled={submitting}
              >
                {submitting ? (
                  <span className="flex items-center gap-2">
                    <span
                      className="h-4 w-4 animate-spin rounded-full border-2 border-red-400/50 border-t-red-300"
                      aria-hidden="true"
                    />
                    Deleting…
                  </span>
                ) : (
                  'Delete'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </Fragment>
  );
};

export default ConnectionsPage;
