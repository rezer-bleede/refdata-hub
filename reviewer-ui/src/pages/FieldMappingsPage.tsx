import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button, Card, Col, Form, Modal, Row, Spinner, Table } from 'react-bootstrap';

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
    <div className="d-flex flex-column gap-4">
      <Card className="card-section">
        <Card.Body className="d-flex flex-column gap-4">
          <div className="d-flex flex-column flex-lg-row justify-content-between gap-3">
            <div>
              <Card.Title as="h1" className="section-heading h4 mb-1">
                Map source fields to reference dimensions
              </Card.Title>
              <Card.Text className="text-body-secondary mb-0">
                Define how source metadata populates canonical domains. Mappings power downstream insights and reviewer workflows.
              </Card.Text>
            </div>
            <Form.Group controlId="connection-select">
              <Form.Label>Active connection</Form.Label>
              <Form.Select
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
              </Form.Select>
            </Form.Group>
          </div>

          <Form
            onSubmit={(event) => {
              event.preventDefault();
              void handleCreate();
            }}
            className="row g-3"
          >
            <Form.Group as={Col} md={4} controlId="mapping-table">
              <Form.Label>Source table</Form.Label>
              <Form.Control
                value={form.source_table}
                onChange={(event) => setForm((prev) => ({ ...prev, source_table: event.target.value }))}
                required
              />
            </Form.Group>
            <Form.Group as={Col} md={4} controlId="mapping-field">
              <Form.Label>Source field</Form.Label>
              <Form.Control
                value={form.source_field}
                onChange={(event) => setForm((prev) => ({ ...prev, source_field: event.target.value }))}
                required
              />
            </Form.Group>
            <Form.Group as={Col} md={4} controlId="mapping-dimension">
              <Form.Label>Reference dimension</Form.Label>
              <Form.Select
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
              </Form.Select>
            </Form.Group>
            <Form.Group as={Col} md={12} controlId="mapping-description">
              <Form.Label>Description</Form.Label>
              <Form.Control
                value={form.description ?? ''}
                placeholder="Optional notes"
                onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))}
              />
            </Form.Group>
            <Col xs={12} className="d-flex justify-content-end">
              <Button type="submit" variant="primary" disabled={creating}>
                {creating ? (
                  <span className="d-inline-flex align-items-center gap-2">
                    <Spinner animation="border" size="sm" role="status" aria-hidden="true" />
                    Creating…
                  </span>
                ) : (
                  'Add mapping'
                )}
              </Button>
            </Col>
          </Form>
        </Card.Body>
      </Card>

      <Card className="card-section">
        <Card.Body className="d-flex flex-column gap-3">
          <div>
            <Card.Title as="h2" className="section-heading h4 mb-1">
              Existing mappings
            </Card.Title>
            <Card.Text className="text-body-secondary mb-0">
              Manage mapped fields for the selected connection. Edit or remove entries as your schema evolves.
            </Card.Text>
          </div>
          <div className="table-responsive">
            <Table striped hover className="align-middle">
              <thead>
                <tr>
                  <th>Source table</th>
                  <th>Source field</th>
                  <th>Dimension</th>
                  <th>Description</th>
                  <th className="text-end">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loadingMappings && (
                  <tr>
                    <td colSpan={5} className="text-center py-4">
                      Loading mappings…
                    </td>
                  </tr>
                )}
                {!loadingMappings && mappings.length === 0 && (
                  <tr>
                    <td colSpan={5} className="text-center text-body-secondary py-4">
                      No mappings configured yet.
                    </td>
                  </tr>
                )}
                {!loadingMappings &&
                  mappings.map((mapping) => (
                    <tr key={mapping.id}>
                      <td className="fw-semibold">{mapping.source_table}</td>
                      <td>{mapping.source_field}</td>
                      <td>{mapping.ref_dimension}</td>
                      <td>{mapping.description || '—'}</td>
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
                  ))}
              </tbody>
            </Table>
          </div>
        </Card.Body>
      </Card>

      <Card className="card-section">
        <Card.Body className="d-flex flex-column gap-3">
          <div>
            <Card.Title as="h2" className="section-heading h4 mb-1">
              Seed sample values
            </Card.Title>
            <Card.Text className="text-body-secondary mb-0">
              Paste representative raw values to quickly generate match statistics. Provide counts as <code>value,count</code>.
            </Card.Text>
          </div>
          <Form className="row g-3" onSubmit={(event) => event.preventDefault()}>
            <Form.Group as={Col} md={4} controlId="sample-table">
              <Form.Label>Source table</Form.Label>
              <Form.Control value={sampleTable} onChange={(event) => setSampleTable(event.target.value)} required />
            </Form.Group>
            <Form.Group as={Col} md={4} controlId="sample-field">
              <Form.Label>Source field</Form.Label>
              <Form.Control value={sampleField} onChange={(event) => setSampleField(event.target.value)} required />
            </Form.Group>
            <Form.Group as={Col} md={4} controlId="sample-dimension">
              <Form.Label>Dimension (optional)</Form.Label>
              <Form.Control
                value={sampleDimension}
                placeholder="Override mapping dimension"
                onChange={(event) => setSampleDimension(event.target.value)}
              />
            </Form.Group>
            <Form.Group as={Col} md={12} controlId="sample-values">
              <Form.Label>Values</Form.Label>
              <Form.Control
                as="textarea"
                rows={6}
                value={sampleInput}
                placeholder={`Example:\nAbu Dhabi,12\nAl Ain,5`}
                onChange={(event) => setSampleInput(event.target.value)}
              />
            </Form.Group>
            <Col xs={12} className="d-flex justify-content-end">
              <Button variant="success" onClick={() => void handleIngest()} disabled={ingesting}>
                {ingesting ? (
                  <span className="d-inline-flex align-items-center gap-2">
                    <Spinner animation="border" size="sm" role="status" aria-hidden="true" />
                    Uploading…
                  </span>
                ) : (
                  'Ingest samples'
                )}
              </Button>
            </Col>
          </Form>
        </Card.Body>
      </Card>

      <Modal show={Boolean(editing)} onHide={() => setEditing(null)} centered>
        <Modal.Header closeButton>
          <Modal.Title>Edit mapping</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form className="d-flex flex-column gap-3">
            <Form.Group controlId="edit-source-table">
              <Form.Label>Source table</Form.Label>
              <Form.Control
                value={editForm.source_table}
                onChange={(event) => setEditForm((prev) => ({ ...prev, source_table: event.target.value }))}
              />
            </Form.Group>
            <Form.Group controlId="edit-source-field">
              <Form.Label>Source field</Form.Label>
              <Form.Control
                value={editForm.source_field}
                onChange={(event) => setEditForm((prev) => ({ ...prev, source_field: event.target.value }))}
              />
            </Form.Group>
            <Form.Group controlId="edit-dimension">
              <Form.Label>Reference dimension</Form.Label>
              <Form.Select
                value={editForm.ref_dimension}
                onChange={(event) => setEditForm((prev) => ({ ...prev, ref_dimension: event.target.value }))}
              >
                {availableDimensions.map((dimension) => (
                  <option key={dimension} value={dimension}>
                    {dimension}
                  </option>
                ))}
              </Form.Select>
            </Form.Group>
            <Form.Group controlId="edit-description">
              <Form.Label>Description</Form.Label>
              <Form.Control
                value={editForm.description ?? ''}
                onChange={(event) => setEditForm((prev) => ({ ...prev, description: event.target.value }))}
              />
            </Form.Group>
          </Form>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="outline-secondary" onClick={() => setEditing(null)}>
            Cancel
          </Button>
          <Button variant="primary" onClick={() => void handleUpdate()} disabled={updating}>
            {updating ? (
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
          Delete mapping for <strong>{deleteTarget?.source_table}</strong> / <strong>{deleteTarget?.source_field}</strong>?
        </Modal.Body>
        <Modal.Footer>
          <Button variant="outline-secondary" onClick={() => setDeleteTarget(null)}>
            Cancel
          </Button>
          <Button variant="danger" onClick={() => void handleDelete()} disabled={deleting}>
            {deleting ? (
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

export default FieldMappingsPage;
