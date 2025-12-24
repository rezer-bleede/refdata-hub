import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button, Card, Form, Modal, Spinner, Table } from '../components/ui';

import {
  deleteValueMapping,
  exportValueMappings,
  fetchAllValueMappings,
  fetchConnectionValueMappings,
  fetchSourceConnections,
  importValueMappings,
  updateValueMapping,
} from '../api';
import { useAppState } from '../state/AppStateContext';
import type {
  CanonicalValue,
  SourceConnection,
  ToastMessage,
  ValueMappingExpanded,
  ValueMappingImportResult,
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
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [exporting, setExporting] = useState<'csv' | 'xlsx' | null>(null);
  const [showImport, setShowImport] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<ValueMappingImportResult | null>(null);

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
      onToast({ type: 'error', content: 'Failed to load connections.' });
    }
  }, [onToast]);

  const loadMappings = useCallback(
    async (connection: number | 'all') => {
      setLoading(true);
      try {
        const records =
          connection === 'all'
            ? await fetchAllValueMappings()
            : await fetchConnectionValueMappings(connection);
        setMappings(records);
      } catch (error) {
        console.error(error);
        onToast({ type: 'error', content: 'Unable to load value mappings.' });
      } finally {
        setLoading(false);
      }
    },
    [onToast],
  );

  useEffect(() => {
    void loadConnections();
  }, [loadConnections]);

  useEffect(() => {
    void loadMappings(selectedConnection);
  }, [selectedConnection, loadMappings]);

  const handleExport = async (format: 'csv' | 'xlsx') => {
    try {
      setExporting(format);
      const blob = await exportValueMappings(selectedConnection === 'all' ? undefined : selectedConnection, format);
      const url = window.URL.createObjectURL(blob);
      const filenamePrefix = selectedConnection === 'all' ? 'all-connections' : `connection-${selectedConnection}`;
      const link = document.createElement('a');
      link.href = url;
      link.download = `value-mappings-${filenamePrefix}.${format === 'csv' ? 'csv' : 'xlsx'}`;
      link.click();
      window.URL.revokeObjectURL(url);
      onToast({ type: 'success', content: `Exported mappings as ${format.toUpperCase()}.` });
    } catch (error) {
      console.error(error);
      onToast({ type: 'error', content: 'Unable to export mappings.' });
    } finally {
      setExporting(null);
    }
  };

  const handleImport = async () => {
    if (selectedConnection === 'all') {
      onToast({ type: 'error', content: 'Select a connection before importing mappings.' });
      return;
    }
    if (!importFile) {
      onToast({ type: 'error', content: 'Choose a CSV or Excel file to import.' });
      return;
    }

    setImporting(true);
    try {
      const result = await importValueMappings(importFile, selectedConnection);
      setImportResult(result);
      await loadMappings(selectedConnection);

      const summary = `Imported ${result.created} created / ${result.updated} updated`;
      const suffix = result.errors.length ? ` with ${result.errors.length} warning(s).` : '.';
      onToast({ type: 'success', content: `${summary}${suffix}` });

      if (!result.errors.length) {
        setShowImport(false);
        setImportFile(null);
        setImportResult(null);
      }
    } catch (error) {
      console.error(error);
      onToast({ type: 'error', content: 'Unable to import mappings.' });
    } finally {
      setImporting(false);
    }
  };

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
    setSaving(true);
    try {
      const payload: ValueMappingUpdatePayload = {
        ...editForm,
        confidence: typeof editForm.confidence === 'number' ? editForm.confidence : undefined,
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
      onToast({ type: 'success', content: 'Mapping updated.' });
      setEditing(null);
    } catch (error) {
      console.error(error);
      onToast({ type: 'error', content: 'Unable to update mapping.' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setRemoving(true);
    try {
      await deleteValueMapping(deleteTarget.source_connection_id, deleteTarget.id);
      setMappings((prev) => prev.filter((item) => item.id !== deleteTarget.id));
      onToast({ type: 'success', content: 'Mapping deleted.' });
      setDeleteTarget(null);
    } catch (error) {
      console.error(error);
      onToast({ type: 'error', content: 'Unable to delete mapping.' });
    } finally {
      setRemoving(false);
      setDeleteTarget(null);
    }
  };

  const renderRows = () => {
    if (loading) {
      return (
        <tr>
          <td colSpan={7} className="text-center py-4">
            <Spinner animation="border" role="status" size="sm" className="mr-2" /> Loading mappings…
          </td>
        </tr>
      );
    }

    if (!mappings.length) {
      return (
        <tr>
          <td colSpan={7} className="text-center text-slate-400 py-4">
            No mappings available for the selected scope.
          </td>
        </tr>
      );
    }

    return mappings.map((mapping) => (
      <tr key={mapping.id}>
        <td className="font-semibold">{mapping.raw_value}</td>
        <td>{mapping.canonical_label}</td>
        <td>{mapping.ref_dimension}</td>
        <td className="font-mono">{mapping.status}</td>
        <td>
          {mapping.confidence != null ? `${(mapping.confidence * 100).toFixed(1)}%` : '—'}
        </td>
        <td className="font-mono">{new Date(mapping.updated_at).toLocaleString()}</td>
        <td className="text-end">
          <div className="inline-flex gap-2">
            <Button size="sm" variant="outline-primary" onClick={() => openEdit(mapping)}>
              Edit
            </Button>
            <Button size="sm" variant="outline-danger" onClick={() => setDeleteTarget(mapping)}>
              Delete
            </Button>
          </div>
        </td>
      </tr>
    ));
  };

  return (
    <div className="flex flex-col gap-4">
      <Card className="card-section">
        <Card.Body className="flex flex-col gap-3">
          <div className="flex flex-col lg:flex-row justify-between gap-3">
            <div>
              <Card.Title as="h1" className="text-2xl mb-1">
                Mapping history
              </Card.Title>
              <Card.Text className="text-slate-400 mb-0">
                Review every approved mapping and ensure canonical assignments stay current.
              </Card.Text>
            </div>
            <div className="flex flex-col items-stretch lg:items-end gap-2 w-full lg:w-auto">
              <Form.Group controlId="history-connection" className="w-full lg:w-auto">
                <Form.Label>Connection</Form.Label>
                <Form.Select
                  value={selectedConnection}
                  onChange={(event) => {
                    const value = event.target.value;
                    setSelectedConnection(value === 'all' ? 'all' : Number(value));
                  }}
                >
                  <option value="all">All connections</option>
                  {connections.map((connection) => (
                    <option key={connection.id} value={connection.id}>
                      {connection.name}
                    </option>
                  ))}
                </Form.Select>
              </Form.Group>
              <div className="flex flex-wrap gap-2 justify-end">
                <Button
                  size="sm"
                  variant="outline-secondary"
                  onClick={() => void handleExport('csv')}
                  disabled={exporting !== null}
                >
                  {exporting === 'csv' ? 'Exporting CSV…' : 'Export CSV'}
                </Button>
                <Button
                  size="sm"
                  variant="outline-secondary"
                  onClick={() => void handleExport('xlsx')}
                  disabled={exporting !== null}
                >
                  {exporting === 'xlsx' ? 'Exporting Excel…' : 'Export Excel'}
                </Button>
                <Button
                  size="sm"
                  variant="primary"
                  onClick={() => {
                    setImportResult(null);
                    setShowImport(true);
                  }}
                >
                  Import
                </Button>
              </div>
            </div>
          </div>
          <div className="overflow-x-auto">
            <Table striped hover className="align-middle whitespace-nowrap">
              <thead>
                <tr>
                  <th>Raw value</th>
                  <th>Canonical label</th>
                  <th>Dimension</th>
                  <th>Status</th>
                  <th>Confidence</th>
                  <th>Updated</th>
                  <th className="text-end">Actions</th>
                </tr>
              </thead>
              <tbody>{renderRows()}</tbody>
            </Table>
          </div>
        </Card.Body>
      </Card>

      <Modal
        show={showImport}
        onHide={() => {
          setShowImport(false);
          setImportFile(null);
          setImportResult(null);
        }}
        centered
      >
        <Modal.Header closeButton>
          <Modal.Title>Import mappings</Modal.Title>
        </Modal.Header>
        <Modal.Body className="flex flex-col gap-3">
          <p className="mb-0 text-slate-500">
            Upload a CSV or Excel file containing mapping rows. Required columns are{' '}
            <code>source_table</code>, <code>source_field</code>, <code>raw_value</code>, and{' '}
            <code>canonical_id</code>. When importing from this page, the selected connection will
            be applied automatically.
          </p>
          <Form.Group controlId="import-file">
            <Form.Label>Import file</Form.Label>
            <Form.Control
              type="file"
              accept=".csv,.xlsx,.xls"
              onChange={(event) => {
                setImportFile(event.target.files?.[0] ?? null);
                setImportResult(null);
              }}
            />
          </Form.Group>
          {importResult && (
            <div className="flex flex-col gap-2 rounded border border-slate-200 p-3 bg-slate-50">
              <div className="font-semibold">Summary</div>
              <div className="text-sm text-slate-600">
                Created {importResult.created} • Updated {importResult.updated}
              </div>
              {importResult.errors.length > 0 && (
                <div className="text-sm text-amber-600">
                  <div className="font-semibold">Warnings</div>
                  <ul className="list-disc pl-5 mt-1 mb-0 space-y-1">
                    {importResult.errors.map((error, index) => (
                      <li key={index}>{error}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button
            variant="outline-secondary"
            onClick={() => {
              setShowImport(false);
              setImportFile(null);
              setImportResult(null);
            }}
          >
            Cancel
          </Button>
          <Button variant="primary" onClick={() => void handleImport()} disabled={importing}>
            {importing ? (
              <span className="inline-flex items-center gap-2">
                <Spinner animation="border" size="sm" role="status" aria-hidden="true" />
                Importing…
              </span>
            ) : (
              'Import mappings'
            )}
          </Button>
        </Modal.Footer>
      </Modal>

      <Modal show={Boolean(editing)} onHide={() => setEditing(null)} centered>
        <Modal.Header closeButton>
          <Modal.Title>Edit mapping</Modal.Title>
        </Modal.Header>
        <Modal.Body className="flex flex-col gap-3">
          <Form.Group controlId="edit-canonical">
            <Form.Label>Canonical value</Form.Label>
            <Form.Select
              value={editForm.canonical_id ?? ''}
              onChange={(event) => setEditForm((prev) => ({ ...prev, canonical_id: Number(event.target.value) }))}
            >
              {(canonicalByDimension.get(editing?.ref_dimension ?? '') ?? canonicalValues).map((canonical) => (
                <option key={canonical.id} value={canonical.id}>
                  {canonical.canonical_label}
                </option>
              ))}
            </Form.Select>
          </Form.Group>
          <Form.Group controlId="edit-status">
            <Form.Label>Status</Form.Label>
            <Form.Select
              value={editForm.status ?? editing?.status ?? 'approved'}
              onChange={(event) => setEditForm((prev) => ({ ...prev, status: event.target.value }))}
            >
              <option value="approved">approved</option>
              <option value="pending">pending</option>
              <option value="rejected">rejected</option>
            </Form.Select>
          </Form.Group>
          <Form.Group controlId="edit-confidence">
            <Form.Label>Confidence</Form.Label>
            <Form.Control
              type="number"
              min={0}
              max={1}
              step="0.01"
              value={editForm.confidence ?? ''}
              placeholder="0.85"
              onChange={(event) =>
                setEditForm((prev) => ({ ...prev, confidence: event.target.value ? Number(event.target.value) : undefined }))
              }
            />
          </Form.Group>
          <Form.Group controlId="edit-notes">
            <Form.Label>Notes</Form.Label>
            <Form.Control
              as="textarea"
              rows={3}
              value={editForm.notes ?? ''}
              onChange={(event) => setEditForm((prev) => ({ ...prev, notes: event.target.value }))}
            />
          </Form.Group>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="outline-secondary" onClick={() => setEditing(null)}>
            Cancel
          </Button>
          <Button variant="primary" onClick={() => void handleUpdate()} disabled={saving}>
            {saving ? (
              <span className="inline-flex items-center gap-2">
                <Spinner animation="border" size="sm" role="status" aria-hidden="true" />
                Saving…
              </span>
            ) : (
              'Save changes'
            )}
          </Button>
        </Modal.Footer>
      </Modal>

      <Modal show={Boolean(deleteTarget)} onHide={() => setDeleteTarget(null)} centered>
        <Modal.Header closeButton>
          <Modal.Title>Delete mapping</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          Delete mapping for <strong>{deleteTarget?.raw_value}</strong> → <strong>{deleteTarget?.canonical_label}</strong>?
        </Modal.Body>
        <Modal.Footer>
          <Button variant="outline-secondary" onClick={() => setDeleteTarget(null)}>
            Cancel
          </Button>
          <Button variant="danger" onClick={() => void handleDelete()} disabled={removing}>
            {removing ? (
              <span className="inline-flex items-center gap-2">
                <Spinner animation="border" size="sm" role="status" aria-hidden="true" />
                Deleting…
              </span>
            ) : (
              'Delete'
            )}
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default MappingHistoryPage;
