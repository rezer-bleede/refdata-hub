import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button, Card, Form, Modal, Spinner, Table } from 'react-bootstrap';

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
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState(false);

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
            <Spinner animation="border" role="status" size="sm" className="me-2" /> Loading mappings…
          </td>
        </tr>
      );
    }

    if (!mappings.length) {
      return (
        <tr>
          <td colSpan={7} className="text-center text-body-secondary py-4">
            No mappings available for the selected scope.
          </td>
        </tr>
      );
    }

    return mappings.map((mapping) => (
      <tr key={mapping.id}>
        <td className="fw-semibold">{mapping.raw_value}</td>
        <td>{mapping.canonical_label}</td>
        <td>{mapping.ref_dimension}</td>
        <td className="text-monospaced">{mapping.status}</td>
        <td>
          {mapping.confidence != null ? `${(mapping.confidence * 100).toFixed(1)}%` : '—'}
        </td>
        <td className="text-monospaced">{new Date(mapping.updated_at).toLocaleString()}</td>
        <td className="text-end">
          <div className="d-inline-flex gap-2">
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
    <div className="d-flex flex-column gap-4">
      <Card className="card-section">
        <Card.Body className="d-flex flex-column gap-3">
          <div className="d-flex flex-column flex-lg-row justify-content-between gap-3">
            <div>
              <Card.Title as="h1" className="section-heading h4 mb-1">
                Mapping history
              </Card.Title>
              <Card.Text className="text-body-secondary mb-0">
                Review every approved mapping and ensure canonical assignments stay current.
              </Card.Text>
            </div>
            <Form.Group controlId="history-connection" className="w-auto">
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
          </div>
          <div className="table-responsive">
            <Table striped hover className="align-middle table-nowrap">
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

      <Modal show={Boolean(editing)} onHide={() => setEditing(null)} centered>
        <Modal.Header closeButton>
          <Modal.Title>Edit mapping</Modal.Title>
        </Modal.Header>
        <Modal.Body className="d-flex flex-column gap-3">
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
              <span className="d-inline-flex align-items-center gap-2">
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
              <span className="d-inline-flex align-items-center gap-2">
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
