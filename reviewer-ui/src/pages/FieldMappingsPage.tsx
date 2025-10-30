import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';

import {
  createFieldMapping,
  deleteFieldMapping,
  fetchFieldMappings,
  fetchSourceConnections,
  fetchSourceFields,
  fetchSourceTables,
  ingestSamples,
  updateFieldMapping,
} from '../api';
import { useAppState } from '../state/AppStateContext';
import type {
  SourceConnection,
  SourceFieldMapping,
  SourceFieldMappingPayload,
  SourceFieldMetadata,
  SourceSampleValuePayload,
  SourceTableMetadata,
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

type TableOption = SourceTableMetadata & { identifier: string; label: string };

const toTableOption = (table: SourceTableMetadata): TableOption => {
  const identifier = table.schema ? `${table.schema}.${table.name}` : table.name;
  const suffix = table.type === 'view' ? ' (view)' : '';
  return {
    ...table,
    identifier,
    label: `${identifier}${suffix}`,
  };
};

const fallbackTableOption = (identifier: string): TableOption => ({
  name: identifier,
  schema: undefined,
  type: 'table',
  identifier,
  label: identifier,
});

const fallbackField = (name: string): SourceFieldMetadata => ({
  name,
  data_type: undefined,
  nullable: undefined,
  default: undefined,
});

const parseTableIdentifier = (identifier: string): { schema?: string; name: string } => {
  if (!identifier) {
    return { schema: undefined, name: identifier };
  }
  const [maybeSchema, maybeName] = identifier.split('.', 2);
  if (maybeName) {
    const schema = maybeSchema.replace(/^"|"$/g, '');
    const name = maybeName.replace(/^"|"$/g, '');
    return { schema: schema || undefined, name };
  }
  return { schema: undefined, name: identifier.replace(/^"|"$/g, '') };
};

const FieldMappingsPage = ({ onToast }: FieldMappingsPageProps) => {
  const { canonicalValues } = useAppState();
  const [connections, setConnections] = useState<SourceConnection[]>([]);
  const [selectedConnectionId, setSelectedConnectionId] = useState<number | ''>('');
  const [mappings, setMappings] = useState<SourceFieldMapping[]>([]);
  const [loadingMappings, setLoadingMappings] = useState(false);
  const [creating, setCreating] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [form, setForm] = useState<SourceFieldMappingPayload>({ ...initialMapping });
  const [editing, setEditing] = useState<SourceFieldMapping | null>(null);
  const [editForm, setEditForm] = useState<SourceFieldMappingPayload>({ ...initialMapping });
  const [deleteTarget, setDeleteTarget] = useState<SourceFieldMapping | null>(null);
  const [sampleTable, setSampleTable] = useState('');
  const [sampleField, setSampleField] = useState('');
  const [sampleDimension, setSampleDimension] = useState('');
  const [sampleInput, setSampleInput] = useState('');
  const [ingesting, setIngesting] = useState(false);
  const [tablesLoading, setTablesLoading] = useState(false);
  const [tableOptions, setTableOptions] = useState<TableOption[]>([]);
  const [fieldsByTable, setFieldsByTable] = useState<Record<string, SourceFieldMetadata[]>>({});
  const [loadingFieldsFor, setLoadingFieldsFor] = useState<string | null>(null);

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
      onToast({ type: 'error', content: 'Failed to load connections.' });
    }
  }, [onToast, selectedConnectionId]);

  const loadMappings = useCallback(
    async (connectionId: number) => {
      setLoadingMappings(true);
      try {
        const records = await fetchFieldMappings(connectionId);
        setMappings(records);
      } catch (error) {
        console.error(error);
        onToast({ type: 'error', content: 'Failed to load field mappings.' });
      } finally {
        setLoadingMappings(false);
      }
    },
    [onToast],
  );

  const loadTables = useCallback(
    async (connectionId: number) => {
      setTablesLoading(true);
      try {
        const records = await fetchSourceTables(connectionId);
        const options = records.map(toTableOption).sort((a, b) => a.label.localeCompare(b.label));
        setTableOptions(options);
      } catch (error) {
        console.error(error);
        onToast({ type: 'error', content: 'Failed to load source tables.' });
      } finally {
        setTablesLoading(false);
      }
    },
    [onToast],
  );

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

  useEffect(() => {
    if (selectedConnectionId) {
      void loadTables(selectedConnectionId);
    } else {
      setTableOptions([]);
      setFieldsByTable({});
    }
  }, [selectedConnectionId, loadTables]);

  useEffect(() => {
    setForm({ ...initialMapping });
    setEditForm({ ...initialMapping });
    setEditing(null);
    setDeleteTarget(null);
    setSampleTable('');
    setSampleField('');
    setSampleDimension('');
    setLoadingFieldsFor(null);
  }, [selectedConnectionId]);

  const ensureFieldsLoaded = useCallback(
    async (connectionId: number, identifier: string) => {
      if (!identifier || fieldsByTable[identifier]) {
        return;
      }

      const table = tableOptions.find((item) => item.identifier === identifier);
      const parsed = parseTableIdentifier(identifier);
      const targetSchema = table?.schema ?? parsed.schema;
      const targetName = table?.name ?? parsed.name;

      setLoadingFieldsFor(identifier);
      try {
        const fields = await fetchSourceFields(connectionId, targetName, targetSchema ?? undefined);
        setFieldsByTable((prev) => ({ ...prev, [identifier]: fields }));
      } catch (error) {
        console.error(error);
        onToast({ type: 'error', content: 'Failed to load source fields.' });
      } finally {
        setLoadingFieldsFor((current) => (current === identifier ? null : current));
      }
    },
    [fieldsByTable, tableOptions, onToast],
  );

  const getFieldOptions = useCallback(
    (identifier: string, selected?: string) => {
      const fields = fieldsByTable[identifier] ?? [];
      if (selected && !fields.some((field) => field.name === selected)) {
        return [...fields, fallbackField(selected)];
      }
      return fields;
    },
    [fieldsByTable],
  );

  const tableOptionList = useMemo(() => {
    const map = new Map<string, TableOption>();
    tableOptions.forEach((table) => {
      map.set(table.identifier, table);
    });
    const ensure = (identifier: string) => {
      if (identifier && !map.has(identifier)) {
        map.set(identifier, fallbackTableOption(identifier));
      }
    };

    ensure(form.source_table);
    ensure(sampleTable);
    ensure(editForm.source_table);

    return Array.from(map.values()).sort((a, b) => a.label.localeCompare(b.label));
  }, [tableOptions, form.source_table, sampleTable, editForm.source_table]);

  const mappingFieldOptions = useMemo(
    () => getFieldOptions(form.source_table, form.source_field),
    [getFieldOptions, form.source_table, form.source_field],
  );

  const sampleFieldOptions = useMemo(
    () => getFieldOptions(sampleTable, sampleField),
    [getFieldOptions, sampleTable, sampleField],
  );

  const editFieldOptions = useMemo(
    () => getFieldOptions(editForm.source_table, editForm.source_field),
    [getFieldOptions, editForm.source_table, editForm.source_field],
  );

  const tablePlaceholder = tablesLoading
    ? 'Loading tables…'
    : tableOptionList.length > 0
    ? 'Select table'
    : 'No tables available';

  const getFieldPlaceholder = (tableId: string, options: SourceFieldMetadata[]): string => {
    if (!tableId) {
      return 'Select table first';
    }
    if (loadingFieldsFor === tableId && options.length === 0) {
      return 'Loading fields…';
    }
    if (options.length === 0) {
      return 'No fields available';
    }
    return 'Select field';
  };

  useEffect(() => {
    if (editing && selectedConnectionId && editForm.source_table) {
      void ensureFieldsLoaded(selectedConnectionId, editForm.source_table);
    }
  }, [editing, editForm.source_table, ensureFieldsLoaded, selectedConnectionId]);

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
      setForm({ ...initialMapping });
      onToast({ type: 'success', content: 'Field mapping created.' });
    } catch (error) {
      console.error(error);
      onToast({ type: 'error', content: 'Unable to create field mapping.' });
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
    setUpdating(true);
    try {
      const updated = await updateFieldMapping(selectedConnectionId, editing.id, editForm);
      setMappings((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
      onToast({ type: 'success', content: 'Field mapping updated.' });
      setEditing(null);
    } catch (error) {
      console.error(error);
      onToast({ type: 'error', content: 'Unable to update mapping.' });
    } finally {
      setUpdating(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget || !selectedConnectionId) return;
    setDeleting(true);
    try {
      await deleteFieldMapping(selectedConnectionId, deleteTarget.id);
      setMappings((prev) => prev.filter((item) => item.id !== deleteTarget.id));
      onToast({ type: 'success', content: 'Field mapping removed.' });
      setDeleteTarget(null);
    } catch (error) {
      console.error(error);
      onToast({ type: 'error', content: 'Unable to delete mapping.' });
    } finally {
      setDeleting(false);
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
      onToast({ type: 'success', content: 'Sample values ingested.' });
      setSampleInput('');
    } catch (error) {
      console.error(error);
      onToast({ type: 'error', content: 'Failed to ingest sample values.' });
    } finally {
      setIngesting(false);
    }
  };

  return (
    <Fragment>
      <div className="flex flex-col gap-8">
        <section className="surface-card flex flex-col gap-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="space-y-2">
              <h1 className="section-heading text-2xl">Map source fields to reference dimensions</h1>
              <p className="text-sm text-slate-400">
                Define how source metadata populates canonical domains. Mappings power downstream insights and reviewer workflows.
              </p>
            </div>
            <label htmlFor="connection-select" className="flex w-full flex-col gap-2 lg:max-w-xs">
              <span className="form-label">Active connection</span>
              <select
                id="connection-select"
                value={selectedConnectionId}
                onChange={(event) =>
                  setSelectedConnectionId(event.target.value ? Number(event.target.value) : '')
                }
              >
                <option value="">Select connection</option>
                {connections.map((connection) => (
                  <option key={connection.id} value={connection.id}>
                    {connection.name}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <form
            onSubmit={(event) => {
              event.preventDefault();
              void handleCreate();
            }}
            className="grid gap-4 lg:grid-cols-3"
          >
            <label htmlFor="mapping-table" className="flex flex-col gap-2">
              <span className="form-label">Source table</span>
              <select
                id="mapping-table"
                value={form.source_table}
                disabled={!selectedConnectionId || tablesLoading || tableOptionList.length === 0}
                onChange={(event) => {
                  const value = event.target.value;
                  setForm((prev) => ({ ...prev, source_table: value, source_field: '' }));
                  if (selectedConnectionId && value) {
                    void ensureFieldsLoaded(selectedConnectionId, value);
                  }
                }}
                required
              >
                <option value="">{tablePlaceholder}</option>
                {tableOptionList.map((table) => (
                  <option key={table.identifier} value={table.identifier}>
                    {table.label}
                  </option>
                ))}
              </select>
            </label>
            <label htmlFor="mapping-field" className="flex flex-col gap-2">
              <span className="form-label">Source field</span>
              <select
                id="mapping-field"
                value={form.source_field}
                disabled={
                  !form.source_table ||
                  (loadingFieldsFor === form.source_table && mappingFieldOptions.length === 0)
                }
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, source_field: event.target.value }))
                }
                required
              >
                <option value="">{getFieldPlaceholder(form.source_table, mappingFieldOptions)}</option>
                {mappingFieldOptions.map((field) => (
                  <option key={field.name} value={field.name}>
                    {field.name}
                  </option>
                ))}
              </select>
            </label>
            <label htmlFor="mapping-dimension" className="flex flex-col gap-2">
              <span className="form-label">Reference dimension</span>
              <select
                id="mapping-dimension"
                value={form.ref_dimension}
                onChange={(event) => setForm((prev) => ({ ...prev, ref_dimension: event.target.value }))}
                required
              >
                <option value="">Select dimension</option>
                {availableDimensions.map((dimension) => (
                  <option key={dimension} value={dimension}>
                    {dimension}
                  </option>
                ))}
              </select>
            </label>
            <label htmlFor="mapping-description" className="flex flex-col gap-2 lg:col-span-3">
              <span className="form-label">Description</span>
              <input
                id="mapping-description"
                value={form.description ?? ''}
                placeholder="Optional notes"
                onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))}
              />
            </label>
            <div className="flex justify-end lg:col-span-3">
              <button type="submit" className="neon-button" disabled={creating}>
                {creating ? (
                  <span className="flex items-center gap-2">
                    <span
                      className="h-4 w-4 animate-spin rounded-full border-2 border-aurora/40 border-t-aurora"
                      aria-hidden="true"
                    />
                    Creating…
                  </span>
                ) : (
                  'Add mapping'
                )}
              </button>
            </div>
          </form>
        </section>

        <section className="surface-card flex flex-col gap-4">
          <div className="space-y-2">
            <h2 className="section-heading text-xl">Existing mappings</h2>
            <p className="text-sm text-slate-400">
              Manage mapped fields for the selected connection. Edit or remove entries as your schema evolves.
            </p>
          </div>
          <div className="overflow-hidden rounded-3xl border border-slate-800/70">
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th className="px-4 py-3 text-left">Source table</th>
                    <th className="px-4 py-3 text-left">Source field</th>
                    <th className="px-4 py-3 text-left">Dimension</th>
                    <th className="px-4 py-3 text-left">Description</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {mappings.map((mapping) => (
                    <tr key={mapping.id} className="bg-slate-900/40">
                      <td className="px-4 py-3 text-slate-100">{mapping.source_table}</td>
                      <td className="px-4 py-3 text-slate-100">{mapping.source_field}</td>
                      <td className="px-4 py-3 text-slate-200">{mapping.ref_dimension}</td>
                      <td className="px-4 py-3 text-sm text-slate-400">{mapping.description || '—'}</td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            className="rounded-full border border-slate-700/60 px-4 py-1 text-xs font-semibold uppercase tracking-[0.3em] text-slate-200 transition hover:border-aurora/50 hover:text-white"
                            onClick={() => openEdit(mapping)}
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            className="rounded-full border border-red-500/50 px-4 py-1 text-xs font-semibold uppercase tracking-[0.3em] text-red-300 transition hover:border-red-400 hover:text-red-100"
                            onClick={() => setDeleteTarget(mapping)}
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {!mappings.length && (
                    <tr>
                      <td colSpan={5} className="px-4 py-6 text-center text-sm text-slate-400">
                        {loadingMappings ? 'Loading mappings…' : 'No mappings defined for this connection.'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <section className="surface-card flex flex-col gap-6">
          <div className="space-y-2">
            <h2 className="section-heading text-xl">Rapid sample ingestion</h2>
            <p className="text-sm text-slate-400">
              Paste representative values to pre-populate reviewer suggestions. Each line supports optional occurrence counts.
            </p>
          </div>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void handleIngest();
            }}
            className="grid gap-4 lg:grid-cols-3"
          >
            <label htmlFor="sample-table" className="flex flex-col gap-2">
              <span className="form-label">Source table</span>
              <select
                id="sample-table"
                value={sampleTable}
                disabled={!selectedConnectionId || tableOptionList.length === 0}
                onChange={(event) => {
                  const value = event.target.value;
                  setSampleTable(value);
                  setSampleField('');
                  if (selectedConnectionId && value) {
                    void ensureFieldsLoaded(selectedConnectionId, value);
                  }
                }}
              >
                <option value="">{tablePlaceholder}</option>
                {tableOptionList.map((table) => (
                  <option key={table.identifier} value={table.identifier}>
                    {table.label}
                  </option>
                ))}
              </select>
            </label>
            <label htmlFor="sample-field" className="flex flex-col gap-2">
              <span className="form-label">Source field</span>
              <select
                id="sample-field"
                value={sampleField}
                disabled={
                  !sampleTable || (loadingFieldsFor === sampleTable && sampleFieldOptions.length === 0)
                }
                onChange={(event) => setSampleField(event.target.value)}
              >
                <option value="">{getFieldPlaceholder(sampleTable, sampleFieldOptions)}</option>
                {sampleFieldOptions.map((field) => (
                  <option key={field.name} value={field.name}>
                    {field.name}
                  </option>
                ))}
              </select>
            </label>
            <label htmlFor="sample-dimension" className="flex flex-col gap-2">
              <span className="form-label">Reference dimension override</span>
              <select
                id="sample-dimension"
                value={sampleDimension}
                onChange={(event) => setSampleDimension(event.target.value)}
              >
                <option value="">Auto from mapping</option>
                {availableDimensions.map((dimension) => (
                  <option key={dimension} value={dimension}>
                    {dimension}
                  </option>
                ))}
              </select>
            </label>
            <label htmlFor="sample-values" className="flex flex-col gap-2 lg:col-span-3">
              <span className="form-label">Sample values</span>
              <textarea
                id="sample-values"
                rows={6}
                placeholder="value one, 42\nvalue two, 13"
                value={sampleInput}
                onChange={(event) => setSampleInput(event.target.value)}
              />
              <span className="text-xs text-slate-500">
                Use “raw value, occurrences”. Dimension override is optional and falls back to the mapping configuration.
              </span>
            </label>
            <div className="flex justify-end lg:col-span-3">
              <button type="submit" className="neon-button" disabled={ingesting}>
                {ingesting ? (
                  <span className="flex items-center gap-2">
                    <span
                      className="h-4 w-4 animate-spin rounded-full border-2 border-neon/40 border-t-neon"
                      aria-hidden="true"
                    />
                    Uploading…
                  </span>
                ) : (
                  'Ingest samples'
                )}
              </button>
            </div>
          </form>
        </section>
      </div>

      {editing && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="edit-mapping-title">
          <div className="modal-panel relative">
            <h3 id="edit-mapping-title" className="modal-title">
              Edit mapping
            </h3>
            <button type="button" className="modal-close" onClick={() => setEditing(null)} aria-label="Close dialog">
              ×
            </button>
            <form className="mt-4 flex flex-col gap-4">
              <label htmlFor="edit-source-table" className="flex flex-col gap-2">
                <span className="form-label">Source table</span>
                <select
                  id="edit-source-table"
                  value={editForm.source_table}
                  disabled={tableOptionList.length === 0}
                  onChange={(event) => {
                    const value = event.target.value;
                    setEditForm((prev) => ({ ...prev, source_table: value, source_field: '' }));
                    if (selectedConnectionId && value) {
                      void ensureFieldsLoaded(selectedConnectionId, value);
                    }
                  }}
                >
                  <option value="">{tablePlaceholder}</option>
                  {tableOptionList.map((table) => (
                    <option key={table.identifier} value={table.identifier}>
                      {table.label}
                    </option>
                  ))}
                </select>
              </label>
              <label htmlFor="edit-source-field" className="flex flex-col gap-2">
                <span className="form-label">Source field</span>
                <select
                  id="edit-source-field"
                  value={editForm.source_field}
                  disabled={
                    !editForm.source_table ||
                    (loadingFieldsFor === editForm.source_table && editFieldOptions.length === 0)
                  }
                  onChange={(event) => setEditForm((prev) => ({ ...prev, source_field: event.target.value }))}
                >
                  <option value="">{getFieldPlaceholder(editForm.source_table, editFieldOptions)}</option>
                  {editFieldOptions.map((field) => (
                    <option key={field.name} value={field.name}>
                      {field.name}
                    </option>
                  ))}
                </select>
              </label>
              <label htmlFor="edit-dimension" className="flex flex-col gap-2">
                <span className="form-label">Reference dimension</span>
                <select
                  id="edit-dimension"
                  value={editForm.ref_dimension}
                  onChange={(event) => setEditForm((prev) => ({ ...prev, ref_dimension: event.target.value }))}
                >
                  {availableDimensions.map((dimension) => (
                    <option key={dimension} value={dimension}>
                      {dimension}
                    </option>
                  ))}
                </select>
              </label>
              <label htmlFor="edit-description" className="flex flex-col gap-2">
                <span className="form-label">Description</span>
                <input
                  id="edit-description"
                  value={editForm.description ?? ''}
                  onChange={(event) => setEditForm((prev) => ({ ...prev, description: event.target.value }))}
                />
              </label>
            </form>
            <div className="modal-actions">
              <button
                type="button"
                className="rounded-full border border-slate-700/60 px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-slate-300 transition hover:border-slate-500 hover:text-white"
                onClick={() => setEditing(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="neon-button"
                onClick={() => void handleUpdate()}
                disabled={updating}
              >
                {updating ? (
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
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="delete-mapping-title">
          <div className="modal-panel relative">
            <h3 id="delete-mapping-title" className="modal-title">
              Delete mapping
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
              Delete mapping for <strong className="text-white">{deleteTarget.source_table}</strong> /{' '}
              <strong className="text-white">{deleteTarget.source_field}</strong>?
            </p>
            <div className="modal-actions">
              <button
                type="button"
                className="rounded-full border border-slate-700/60 px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-slate-300 transition hover:border-slate-500 hover:text-white"
                onClick={() => setDeleteTarget(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="rounded-full border border-red-500/60 bg-red-500/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-red-200 transition hover:border-red-400 hover:text-red-100 disabled:opacity-50"
                onClick={() => void handleDelete()}
                disabled={deleting}
              >
                {deleting ? (
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

export default FieldMappingsPage;
