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
import { DB_PROVIDERS, DbLogoIcon, type DbProviderInfo } from '../components/DbLogos';
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
  const [selectedProvider, setSelectedProvider] = useState<DbProviderInfo>(DB_PROVIDERS[0]);
  const [isRegistrationModalOpen, setIsRegistrationModalOpen] = useState(false);
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

  const openProviderRegistration = (provider: DbProviderInfo) => {
    setSelectedProvider(provider);
    setForm({
      ...emptyForm,
      db_type: provider.db_type,
      port: provider.defaultPort,
    });
    setIsRegistrationModalOpen(true);
  };

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
      setIsRegistrationModalOpen(false);
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
        <section className="surface-card flex flex-col gap-4">
          <div className="space-y-2">
            <h1 className="section-heading text-2xl">Source connections</h1>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Edit or remove existing integrations. Deleting a connection removes associated mappings and samples.
            </p>
          </div>
          <div className="overflow-hidden rounded-3xl border border-[var(--color-border-strong)]">
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th className="px-4 py-3 text-left">Name</th>
                    <th className="px-4 py-3 text-left">Type</th>
                    <th className="px-4 py-3 text-left">Database</th>
                    <th className="px-4 py-3 text-left">Host</th>
                    <th className="px-4 py-3 text-left">Updated</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loading && (
                    <tr>
                      <td colSpan={6} className="px-4 py-6 text-center text-sm text-slate-600 dark:text-slate-400">
                        Loading connections…
                      </td>
                    </tr>
                  )}
                  {!loading && sortedConnections.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-4 py-6 text-center text-sm text-slate-600 dark:text-slate-400">
                        No connections registered yet. Select a database engine below to register one.
                      </td>
                    </tr>
                  )}
                  {!loading &&
                    sortedConnections.map((connection) => {
                      const matchedProvider = DB_PROVIDERS.find(
                        (p) => p.db_type === connection.db_type || p.id === connection.db_type,
                      );
                      const providerId = matchedProvider?.id || 'generic';
                      return (
                        <tr key={connection.id}>
                          <td className="px-4 py-3 font-semibold text-[var(--color-text-primary)]">
                            <div className="flex items-center gap-3">
                              <DbLogoIcon id={providerId} className="h-6 w-6 shrink-0" />
                              <span>{connection.name}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-xs uppercase text-slate-600 dark:text-slate-400">
                            {connection.db_type}
                          </td>
                          <td className="px-4 py-3 text-[var(--color-text-secondary)]">{connection.database}</td>
                          <td className="px-4 py-3 text-[var(--color-text-secondary)]">{connection.host}</td>
                          <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-400">
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
                      );
                    })}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <section className="surface-card flex flex-col gap-6">
          <div className="space-y-2">
            <h2 className="section-heading text-xl">Register a source connection</h2>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Select a database provider below to configure connection parameters and integrate with RefData Hub.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {DB_PROVIDERS.map((provider) => (
              <button
                key={provider.id}
                type="button"
                onClick={() => openProviderRegistration(provider)}
                className="group flex flex-col items-center justify-between rounded-2xl border border-[var(--color-border-muted)] bg-[var(--color-surface-soft)] p-5 text-center transition hover:-translate-y-0.5 hover:border-indigo-500 hover:bg-[var(--color-surface-strong)] hover:shadow-glow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-500"
              >
                <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-slate-900/40 p-2 shadow-inner transition group-hover:scale-110">
                  <DbLogoIcon id={provider.id} className="h-9 w-9" />
                </div>
                <div className="flex flex-col items-center gap-1">
                  <span className="text-sm font-semibold text-[var(--color-text-primary)]">{provider.name}</span>
                  <span className="text-[0.65rem] uppercase tracking-wider text-slate-600 dark:text-slate-400">
                    {provider.category}
                  </span>
                </div>
                <span className="mt-3 inline-flex items-center rounded-full bg-indigo-500/10 px-2.5 py-0.5 text-[0.65rem] font-medium text-indigo-700 dark:text-indigo-300">
                  {provider.defaultPort > 0 ? `Port ${provider.defaultPort}` : 'Embedded'}
                </span>
              </button>
            ))}
          </div>
        </section>
      </div>

      {isRegistrationModalOpen && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="register-connection-title">
          <div className="modal-panel relative max-w-2xl">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-900/60 p-2">
                <DbLogoIcon id={selectedProvider.id} className="h-9 w-9" />
              </div>
              <div>
                <h3 id="register-connection-title" className="modal-title">
                  Register {selectedProvider.name} Connection
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-400">
                  Configure connection parameters for {selectedProvider.name} ({selectedProvider.category}).
                </p>
              </div>
            </div>
            <button
              type="button"
              className="modal-close"
              onClick={() => setIsRegistrationModalOpen(false)}
              aria-label="Close dialog"
            >
              ×
            </button>

            <form
              onSubmit={(event) => {
                event.preventDefault();
                void handleCreate();
              }}
              className="mt-6 grid gap-4 lg:grid-cols-2"
            >
              <label htmlFor="connection-name" className="flex flex-col gap-2">
                <span className="text-xs font-semibold uppercase tracking-[0.35em] text-slate-600 dark:text-slate-400">Connection name</span>
                <input
                  id="connection-name"
                  className="form-input"
                  placeholder={`e.g. ${selectedProvider.name} Production`}
                  value={form.name}
                  onChange={(event) => handleFormChange('name', event.target.value)}
                  required
                />
              </label>
              <label htmlFor="connection-type" className="flex flex-col gap-2">
                <span className="text-xs font-semibold uppercase tracking-[0.35em] text-slate-600 dark:text-slate-400">Database type</span>
                <input
                  id="connection-type"
                  className="form-input"
                  value={form.db_type}
                  onChange={(event) => handleFormChange('db_type', event.target.value)}
                />
              </label>
              <label htmlFor="connection-host" className="flex flex-col gap-2">
                <span className="text-xs font-semibold uppercase tracking-[0.35em] text-slate-600 dark:text-slate-400">Host</span>
                <input
                  id="connection-host"
                  className="form-input"
                  placeholder="e.g. localhost or db.internal"
                  value={form.host}
                  onChange={(event) => handleFormChange('host', event.target.value)}
                  required
                />
              </label>
              <label htmlFor="connection-port" className="flex flex-col gap-2">
                <span className="text-xs font-semibold uppercase tracking-[0.35em] text-slate-600 dark:text-slate-400">Port</span>
                <input
                  id="connection-port"
                  className="form-input"
                  type="number"
                  value={form.port}
                  onChange={(event) => handleFormChange('port', event.target.value)}
                />
              </label>
              <label htmlFor="connection-database" className="flex flex-col gap-2">
                <span className="text-xs font-semibold uppercase tracking-[0.35em] text-slate-600 dark:text-slate-400">Database</span>
                <input
                  id="connection-database"
                  className="form-input"
                  placeholder="e.g. analytics"
                  value={form.database}
                  onChange={(event) => handleFormChange('database', event.target.value)}
                  required
                />
              </label>
              <label htmlFor="connection-username" className="flex flex-col gap-2">
                <span className="text-xs font-semibold uppercase tracking-[0.35em] text-slate-600 dark:text-slate-400">Username</span>
                <input
                  id="connection-username"
                  className="form-input"
                  placeholder="e.g. postgres"
                  value={form.username}
                  onChange={(event) => handleFormChange('username', event.target.value)}
                  required
                />
              </label>
              <label htmlFor="connection-password" className="flex flex-col gap-2">
                <span className="text-xs font-semibold uppercase tracking-[0.35em] text-slate-600 dark:text-slate-400">Password</span>
                <input
                  id="connection-password"
                  className="form-input"
                  type="password"
                  value={form.password ?? ''}
                  onChange={(event) => handleFormChange('password', event.target.value)}
                />
              </label>
              <label htmlFor="connection-options" className="flex flex-col gap-2 lg:col-span-2">
                <span className="text-xs font-semibold uppercase tracking-[0.35em] text-slate-600 dark:text-slate-400">Options (JSON)</span>
                <input
                  id="connection-options"
                  className="form-input"
                  placeholder='{"sslmode":"require"}'
                  value={form.options ?? ''}
                  onChange={(event) => handleFormChange('options', event.target.value)}
                />
              </label>

              <div className="mt-4 flex justify-end gap-3 lg:col-span-2">
                <button
                  type="button"
                  className="button-secondary"
                  onClick={() => setIsRegistrationModalOpen(false)}
                >
                  Cancel
                </button>
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
          </div>
        </div>
      )}

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
                <span className="text-xs font-semibold uppercase tracking-[0.35em] text-slate-600 dark:text-slate-400">Name</span>
                <input
                  id="edit-name"
                  className="form-input"
                  value={editForm.name ?? ''}
                  onChange={(event) => handleEditChange('name', event.target.value)}
                />
              </label>
              <label htmlFor="edit-db-type" className="flex flex-col gap-2">
                <span className="text-xs font-semibold uppercase tracking-[0.35em] text-slate-600 dark:text-slate-400">Database type</span>
                <input
                  id="edit-db-type"
                  className="form-input"
                  value={editForm.db_type ?? ''}
                  onChange={(event) => handleEditChange('db_type', event.target.value)}
                />
              </label>
              <label htmlFor="edit-host" className="flex flex-col gap-2">
                <span className="text-xs font-semibold uppercase tracking-[0.35em] text-slate-600 dark:text-slate-400">Host</span>
                <input
                  id="edit-host"
                  className="form-input"
                  value={editForm.host ?? ''}
                  onChange={(event) => handleEditChange('host', event.target.value)}
                />
              </label>
              <label htmlFor="edit-port" className="flex flex-col gap-2">
                <span className="text-xs font-semibold uppercase tracking-[0.35em] text-slate-600 dark:text-slate-400">Port</span>
                <input
                  id="edit-port"
                  className="form-input"
                  type="number"
                  value={editForm.port ?? 0}
                  onChange={(event) => handleEditChange('port', event.target.value)}
                />
              </label>
              <label htmlFor="edit-database" className="flex flex-col gap-2">
                <span className="text-xs font-semibold uppercase tracking-[0.35em] text-slate-600 dark:text-slate-400">Database</span>
                <input
                  id="edit-database"
                  className="form-input"
                  value={editForm.database ?? ''}
                  onChange={(event) => handleEditChange('database', event.target.value)}
                />
              </label>
              <label htmlFor="edit-username" className="flex flex-col gap-2">
                <span className="text-xs font-semibold uppercase tracking-[0.35em] text-slate-600 dark:text-slate-400">Username</span>
                <input
                  id="edit-username"
                  className="form-input"
                  value={editForm.username ?? ''}
                  onChange={(event) => handleEditChange('username', event.target.value)}
                />
              </label>
              <label htmlFor="edit-password" className="flex flex-col gap-2">
                <span className="text-xs font-semibold uppercase tracking-[0.35em] text-slate-600 dark:text-slate-400">Password</span>
                <input
                  id="edit-password"
                  className="form-input"
                  type="password"
                  value={editForm.password ?? ''}
                  onChange={(event) => handleEditChange('password', event.target.value)}
                />
              </label>
              <label htmlFor="edit-options" className="flex flex-col gap-2 lg:col-span-2">
                <span className="text-xs font-semibold uppercase tracking-[0.35em] text-slate-600 dark:text-slate-400">Options</span>
                <input
                  id="edit-options"
                  className="form-input"
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
            <p className="mt-4 text-sm text-[var(--color-text-secondary)]">
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
