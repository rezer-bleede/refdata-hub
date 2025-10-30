import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button, Card, Col, Form, Modal, Row, Spinner, Table } from 'react-bootstrap';
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
    <div className="d-flex flex-column gap-4">
      <Card className="card-section">
        <Card.Body className="d-flex flex-column gap-4">
          <div>
            <Card.Title as="h1" className="section-heading h4 mb-1">
              Register a source connection
            </Card.Title>
            <Card.Text className="text-body-secondary mb-0">
              Store connection metadata for sampling, mapping, and reconciliation workflows.
            </Card.Text>
          </div>

          <Form
            onSubmit={(event) => {
              event.preventDefault();
              void handleCreate();
            }}
          >
            <Row className="g-3">
              <Col md={4}>
                <Form.Group controlId="connection-name">
                  <Form.Label>Connection name</Form.Label>
                  <Form.Control
                    value={form.name}
                    onChange={(event) => handleFormChange('name', event.target.value)}
                    required
                  />
                </Form.Group>
              </Col>
              <Col md={4}>
                <Form.Group controlId="connection-type">
                  <Form.Label>Database type</Form.Label>
                  <Form.Control
                    value={form.db_type}
                    onChange={(event) => handleFormChange('db_type', event.target.value)}
                  />
                </Form.Group>
              </Col>
              <Col md={4}>
                <Form.Group controlId="connection-host">
                  <Form.Label>Host</Form.Label>
                  <Form.Control
                    value={form.host}
                    onChange={(event) => handleFormChange('host', event.target.value)}
                    required
                  />
                </Form.Group>
              </Col>
              <Col md={3}>
                <Form.Group controlId="connection-port">
                  <Form.Label>Port</Form.Label>
                  <Form.Control
                    type="number"
                    value={form.port}
                    onChange={(event) => handleFormChange('port', event.target.value)}
                  />
                </Form.Group>
              </Col>
              <Col md={3}>
                <Form.Group controlId="connection-database">
                  <Form.Label>Database</Form.Label>
                  <Form.Control
                    value={form.database}
                    onChange={(event) => handleFormChange('database', event.target.value)}
                    required
                  />
                </Form.Group>
              </Col>
              <Col md={3}>
                <Form.Group controlId="connection-username">
                  <Form.Label>Username</Form.Label>
                  <Form.Control
                    value={form.username}
                    onChange={(event) => handleFormChange('username', event.target.value)}
                    required
                  />
                </Form.Group>
              </Col>
              <Col md={3}>
                <Form.Group controlId="connection-password">
                  <Form.Label>Password</Form.Label>
                  <Form.Control
                    type="password"
                    value={form.password ?? ''}
                    onChange={(event) => handleFormChange('password', event.target.value)}
                  />
                </Form.Group>
              </Col>
              <Col md={12}>
                <Form.Group controlId="connection-options">
                  <Form.Label>Options (JSON)</Form.Label>
                  <Form.Control
                    placeholder='{"sslmode":"require"}'
                    value={form.options ?? ''}
                    onChange={(event) => handleFormChange('options', event.target.value)}
                  />
                </Form.Group>
              </Col>
            </Row>
            <div className="d-flex justify-content-end mt-4 gap-2">
              <Button
                type="button"
                variant="outline-secondary"
                onClick={() => void handleTestNewConnection()}
                disabled={testingNewConnection || submitting}
              >
                {testingNewConnection ? (
                  <span className="d-inline-flex align-items-center gap-2">
                    <Spinner animation="border" size="sm" role="status" aria-hidden="true" />
                    Testing…
                  </span>
                ) : (
                  'Test connection'
                )}
              </Button>
              <Button type="submit" variant="primary" disabled={submitting || testingNewConnection}>
                {submitting ? (
                  <span className="d-inline-flex align-items-center gap-2">
                    <Spinner animation="border" size="sm" role="status" aria-hidden="true" />
                    Adding…
                  </span>
                ) : (
                  'Add connection'
                )}
              </Button>
            </div>
          </Form>
        </Card.Body>
      </Card>

      <Card className="card-section">
        <Card.Body>
          <Card.Title as="h2" className="section-heading h4 mb-2">
            Source connections
          </Card.Title>
          <Card.Text className="text-body-secondary">
            Edit or remove existing integrations. Deleting a connection removes associated mappings and samples.
          </Card.Text>
          <div className="table-responsive">
            <Table striped hover className="align-middle">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Database</th>
                  <th>Host</th>
                  <th className="text-nowrap">Updated</th>
                  <th className="text-end">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr>
                    <td colSpan={5} className="text-center py-4">
                      Loading connections…
                    </td>
                  </tr>
                )}
                {!loading && sortedConnections.length === 0 && (
                  <tr>
                    <td colSpan={5} className="text-center text-body-secondary py-4">
                      No connections registered yet.
                    </td>
                  </tr>
                )}
                {!loading &&
                  sortedConnections.map((connection) => (
                    <tr key={connection.id}>
                      <td className="fw-semibold">{connection.name}</td>
                      <td>{connection.database}</td>
                      <td>{connection.host}</td>
                      <td className="text-monospaced">{new Date(connection.updated_at).toLocaleString()}</td>
                      <td className="text-end">
                        <div className="d-inline-flex gap-2">
                          <Link
                            to={`/connections/${connection.id}`}
                            className="btn btn-sm btn-primary"
                          >
                            View
                          </Link>
                          <Button
                            size="sm"
                            variant="outline-secondary"
                            onClick={() => void handleTestExistingConnection(connection.id)}
                            disabled={testingExistingId === connection.id}
                          >
                            {testingExistingId === connection.id ? (
                              <span className="d-inline-flex align-items-center gap-2">
                                <Spinner animation="border" size="sm" role="status" aria-hidden="true" />
                                Testing…
                              </span>
                            ) : (
                              'Test'
                            )}
                          </Button>
                          <Button size="sm" variant="outline-primary" onClick={() => openEdit(connection)}>
                            Edit
                          </Button>
                          <Button size="sm" variant="outline-danger" onClick={() => setDeleteTarget(connection)}>
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

      <Modal show={Boolean(editing)} onHide={() => setEditing(null)} centered>
        <Modal.Header closeButton>
          <Modal.Title>Edit connection</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form className="d-flex flex-column gap-3">
            <Form.Group controlId="edit-name">
              <Form.Label>Name</Form.Label>
              <Form.Control
                value={editForm.name ?? ''}
                onChange={(event) => handleEditChange('name', event.target.value)}
              />
            </Form.Group>
            <Form.Group controlId="edit-db-type">
              <Form.Label>Database type</Form.Label>
              <Form.Control
                value={editForm.db_type ?? ''}
                onChange={(event) => handleEditChange('db_type', event.target.value)}
              />
            </Form.Group>
            <Form.Group controlId="edit-host">
              <Form.Label>Host</Form.Label>
              <Form.Control
                value={editForm.host ?? ''}
                onChange={(event) => handleEditChange('host', event.target.value)}
              />
            </Form.Group>
            <Form.Group controlId="edit-port">
              <Form.Label>Port</Form.Label>
              <Form.Control
                type="number"
                value={editForm.port ?? 0}
                onChange={(event) => handleEditChange('port', event.target.value)}
              />
            </Form.Group>
            <Form.Group controlId="edit-database">
              <Form.Label>Database</Form.Label>
              <Form.Control
                value={editForm.database ?? ''}
                onChange={(event) => handleEditChange('database', event.target.value)}
              />
            </Form.Group>
            <Form.Group controlId="edit-username">
              <Form.Label>Username</Form.Label>
              <Form.Control
                value={editForm.username ?? ''}
                onChange={(event) => handleEditChange('username', event.target.value)}
              />
            </Form.Group>
            <Form.Group controlId="edit-password">
              <Form.Label>Password</Form.Label>
              <Form.Control
                type="password"
                value={editForm.password ?? ''}
                onChange={(event) => handleEditChange('password', event.target.value)}
              />
            </Form.Group>
            <Form.Group controlId="edit-options">
              <Form.Label>Options</Form.Label>
              <Form.Control
                value={editForm.options ?? ''}
                onChange={(event) => handleEditChange('options', event.target.value)}
              />
            </Form.Group>
          </Form>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="outline-secondary" onClick={() => setEditing(null)}>
            Cancel
          </Button>
          <Button
            variant="outline-secondary"
            onClick={() => editing && void handleTestExistingConnection(editing.id, editForm)}
            disabled={!editing || testingExistingId === editing.id}
          >
            {editing && testingExistingId === editing.id ? (
              <span className="d-inline-flex align-items-center gap-2">
                <Spinner animation="border" size="sm" role="status" aria-hidden="true" />
                Testing…
              </span>
            ) : (
              'Test connection'
            )}
          </Button>
          <Button variant="primary" onClick={() => void handleUpdate()} disabled={submitting}>
            {submitting ? (
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
          <Modal.Title>Delete connection</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          Delete “{deleteTarget?.name}”? Associated mappings, samples, and value mappings will also be removed.
        </Modal.Body>
        <Modal.Footer>
          <Button variant="outline-secondary" onClick={() => setDeleteTarget(null)}>
            Cancel
          </Button>
          <Button variant="danger" onClick={() => void handleDelete()} disabled={submitting}>
            {submitting ? (
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

export default ConnectionsPage;
