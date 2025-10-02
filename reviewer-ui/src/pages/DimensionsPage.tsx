import { useMemo, useState } from 'react';
import {
  Badge,
  Button,
  Card,
  Col,
  Form,
  Modal,
  Row,
  Spinner,
  Table,
} from 'react-bootstrap';

import {
  createDimension,
  deleteDimension,
  updateDimension,
} from '../api';
import { useAppState } from '../state/AppStateContext';
import type {
  DimensionCreatePayload,
  DimensionDefinition,
  DimensionExtraFieldDefinition,
  DimensionExtraFieldType,
  DimensionUpdatePayload,
  ToastMessage,
} from '../types';

interface DimensionsPageProps {
  onToast: (toast: ToastMessage) => void;
}

interface ExtraFieldDraft extends DimensionExtraFieldDefinition {
  id: string;
}

const createEmptyExtraField = (id: string): ExtraFieldDraft => ({
  id,
  key: '',
  label: '',
  description: '',
  data_type: 'string',
  required: false,
});

const DimensionsPage = ({ onToast }: DimensionsPageProps) => {
  const { dimensions, updateDimensions } = useAppState();
  const [showEditor, setShowEditor] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editing, setEditing] = useState<DimensionDefinition | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DimensionDefinition | null>(null);
  const [draft, setDraft] = useState<DimensionCreatePayload>({
    code: '',
    label: '',
    description: '',
    extra_fields: [],
  });
  const [draftFields, setDraftFields] = useState<ExtraFieldDraft[]>([]);

  const sortedDimensions = useMemo(() => {
    return [...dimensions].sort((a, b) => a.label.localeCompare(b.label));
  }, [dimensions]);

  const openCreateModal = () => {
    setEditing(null);
    setDraft({ code: '', label: '', description: '', extra_fields: [] });
    setDraftFields([]);
    setShowEditor(true);
  };

  const openEditModal = (dimension: DimensionDefinition) => {
    setEditing(dimension);
    setDraft({
      code: dimension.code,
      label: dimension.label,
      description: dimension.description ?? '',
      extra_fields: dimension.extra_fields,
    });
    setDraftFields(
      dimension.extra_fields.map((field) => ({
        ...field,
        description: field.description ?? '',
        id: `${field.key}`,
      })),
    );
    setShowEditor(true);
  };

  const resetEditor = () => {
    setShowEditor(false);
    setEditing(null);
    setDraft({ code: '', label: '', description: '', extra_fields: [] });
    setDraftFields([]);
  };

  const handleFieldChange = <K extends keyof ExtraFieldDraft>(id: string, key: K, value: ExtraFieldDraft[K]) => {
    setDraftFields((prev) => prev.map((field) => (field.id === id ? { ...field, [key]: value } : field)));
  };

  const addExtraField = () => {
    setDraftFields((prev) => [...prev, createEmptyExtraField(`field-${Date.now()}-${prev.length}`)]);
  };

  const removeExtraField = (id: string) => {
    setDraftFields((prev) => prev.filter((field) => field.id !== id));
  };

  const buildPayload = (): DimensionCreatePayload | DimensionUpdatePayload | null => {
    if (!draft.code.trim() || !draft.label.trim()) {
      onToast({ type: 'error', content: 'Dimension code and label are required.' });
      return null;
    }

    const normalisedFields: DimensionExtraFieldDefinition[] = draftFields.map((field) => ({
      key: field.key.trim(),
      label: field.label.trim(),
      description: field.description?.trim() || undefined,
      data_type: field.data_type,
      required: field.required,
    }));

    for (const field of normalisedFields) {
      if (!field.key || !field.label) {
        onToast({ type: 'error', content: 'Attribute keys and labels cannot be empty.' });
        return null;
      }
    }

    const payload: DimensionCreatePayload = {
      code: draft.code.trim(),
      label: draft.label.trim(),
      description: draft.description?.trim() || undefined,
      extra_fields: normalisedFields,
    };

    if (editing) {
      const updatePayload: DimensionUpdatePayload = {
        label: payload.label,
        description: payload.description,
        extra_fields: payload.extra_fields,
      };
      return updatePayload;
    }

    return payload;
  };

  const handleSave = async () => {
    const payload = buildPayload();
    if (!payload) {
      return;
    }

    setIsSubmitting(true);
    try {
      if (editing) {
        const updated = await updateDimension(editing.code, payload as DimensionUpdatePayload);
        updateDimensions((prev) => prev.map((dimension) => (dimension.code === updated.code ? updated : dimension)));
        onToast({ type: 'success', content: 'Dimension updated.' });
      } else {
        const created = await createDimension(payload as DimensionCreatePayload);
        updateDimensions((prev) => [...prev, created]);
        onToast({ type: 'success', content: 'Dimension created.' });
      }
      resetEditor();
    } catch (error: unknown) {
      console.error(error);
      onToast({ type: 'error', content: 'Unable to save dimension.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) {
      return;
    }
    setIsSubmitting(true);
    try {
      await deleteDimension(deleteTarget.code);
      updateDimensions((prev) => prev.filter((dimension) => dimension.code !== deleteTarget.code));
      onToast({ type: 'success', content: 'Dimension deleted.' });
      setDeleteTarget(null);
    } catch (error: unknown) {
      console.error(error);
      onToast({ type: 'error', content: 'Unable to delete dimension. Remove related canonical values first.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderFieldTypeLabel = (type: DimensionExtraFieldType) => {
    switch (type) {
      case 'number':
        return 'Number';
      case 'boolean':
        return 'Yes/No';
      default:
        return 'Text';
    }
  };

  return (
    <div className="d-flex flex-column gap-4" aria-label="Dimension registry">
      <Card className="card-section">
        <Card.Body className="d-flex flex-column gap-4">
          <div className="d-flex flex-column flex-lg-row justify-content-between align-items-lg-center gap-3">
            <div>
              <Card.Title as="h1" className="section-heading h4 mb-1">
                Dimension registry
              </Card.Title>
              <Card.Text className="text-body-secondary mb-0">
                Define the label, description, and custom attributes available for each canonical dimension. Attributes
                surface in the canonical library for every value assigned to the dimension.
              </Card.Text>
            </div>
            <Button variant="primary" onClick={openCreateModal}>
              New dimension
            </Button>
          </div>

          <div className="table-responsive">
            <Table striped hover className="align-middle table-nowrap">
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Label</th>
                  <th>Description</th>
                  <th>Attributes</th>
                  <th className="text-end">Actions</th>
                </tr>
              </thead>
              <tbody>
                {sortedDimensions.length === 0 && (
                  <tr>
                    <td colSpan={5} className="text-center text-body-secondary py-4">
                      No dimensions defined yet. Create one to begin collecting canonical values.
                    </td>
                  </tr>
                )}
                {sortedDimensions.map((dimension) => (
                  <tr key={dimension.code}>
                    <td className="fw-semibold text-monospace">{dimension.code}</td>
                    <td>{dimension.label}</td>
                    <td>{dimension.description || '—'}</td>
                    <td>
                      {dimension.extra_fields.length === 0 ? (
                        '—'
                      ) : (
                        <div className="d-flex flex-wrap gap-2">
                          {dimension.extra_fields.map((field) => (
                            <Badge key={field.key} bg="info" text="dark">
                              {field.label} · {renderFieldTypeLabel(field.data_type)}
                              {field.required ? ' · required' : ''}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="text-end">
                      <div className="d-inline-flex gap-2">
                        <Button size="sm" variant="outline-primary" onClick={() => openEditModal(dimension)}>
                          Edit
                        </Button>
                        <Button size="sm" variant="outline-danger" onClick={() => setDeleteTarget(dimension)}>
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

      <Modal show={showEditor} onHide={resetEditor} size="lg" centered>
        <Modal.Header closeButton>
          <Modal.Title>{editing ? 'Edit dimension' : 'New dimension'}</Modal.Title>
        </Modal.Header>
        <Modal.Body className="d-flex flex-column gap-4">
          <Row className="g-3">
            <Col md={4}>
              <Form.Group controlId="dimension-code">
                <Form.Label>Code</Form.Label>
                <Form.Control
                  type="text"
                  value={draft.code}
                  onChange={(event) => setDraft((prev) => ({ ...prev, code: event.target.value }))}
                  placeholder="e.g. region"
                  disabled={Boolean(editing)}
                />
                <Form.Text className="text-body-secondary">
                  Immutable identifier used by canonical values and mappings.
                </Form.Text>
              </Form.Group>
            </Col>
            <Col md={8}>
              <Form.Group controlId="dimension-label">
                <Form.Label>Label</Form.Label>
                <Form.Control
                  type="text"
                  value={draft.label}
                  onChange={(event) => setDraft((prev) => ({ ...prev, label: event.target.value }))}
                  placeholder="Human-friendly dimension name"
                />
              </Form.Group>
            </Col>
          </Row>
          <Form.Group controlId="dimension-description">
            <Form.Label>Description</Form.Label>
            <Form.Control
              as="textarea"
              rows={3}
              value={draft.description ?? ''}
              onChange={(event) => setDraft((prev) => ({ ...prev, description: event.target.value }))}
              placeholder="Optional description for reviewers"
            />
          </Form.Group>

          <div className="d-flex flex-column gap-3">
            <div className="d-flex justify-content-between align-items-center">
              <div>
                <h2 className="h6 mb-1">Additional attributes</h2>
                <p className="text-body-secondary mb-0">
                  Define custom fields captured for canonical values in this dimension. They will appear in the canonical
                  library editor.
                </p>
              </div>
              <Button variant="outline-primary" size="sm" onClick={addExtraField}>
                Add attribute
              </Button>
            </div>

            {draftFields.length === 0 && (
              <p className="text-body-secondary mb-0">No attributes defined. Canonical values will only collect label and description.</p>
            )}

            {draftFields.map((field) => (
              <Card key={field.id} className="border-0 shadow-sm">
                <Card.Body className="d-flex flex-column gap-3">
                  <Row className="g-3 align-items-end">
                    <Col md={4}>
                      <Form.Group controlId={`field-key-${field.id}`}>
                        <Form.Label>Key</Form.Label>
                        <Form.Control
                          type="text"
                          value={field.key}
                          onChange={(event) => handleFieldChange(field.id, 'key', event.target.value)}
                          placeholder="e.g. iso_code"
                        />
                      </Form.Group>
                    </Col>
                    <Col md={4}>
                      <Form.Group controlId={`field-label-${field.id}`}>
                        <Form.Label>Label</Form.Label>
                        <Form.Control
                          type="text"
                          value={field.label}
                          onChange={(event) => handleFieldChange(field.id, 'label', event.target.value)}
                          placeholder="Display name"
                        />
                      </Form.Group>
                    </Col>
                    <Col md={3}>
                      <Form.Group controlId={`field-type-${field.id}`}>
                        <Form.Label>Type</Form.Label>
                        <Form.Select
                          value={field.data_type}
                          onChange={(event) => handleFieldChange(field.id, 'data_type', event.target.value as DimensionExtraFieldType)}
                        >
                          <option value="string">Text</option>
                          <option value="number">Number</option>
                          <option value="boolean">Yes/No</option>
                        </Form.Select>
                      </Form.Group>
                    </Col>
                    <Col md={1} className="text-end">
                      <Button
                        variant="outline-danger"
                        size="sm"
                        onClick={() => removeExtraField(field.id)}
                        aria-label={`Remove attribute ${field.label || field.key || field.id}`}
                      >
                        Remove
                      </Button>
                    </Col>
                  </Row>
                  <Row className="g-3">
                    <Col md={9}>
                      <Form.Group controlId={`field-description-${field.id}`}>
                        <Form.Label>Description</Form.Label>
                        <Form.Control
                          type="text"
                          value={field.description ?? ''}
                          onChange={(event) => handleFieldChange(field.id, 'description', event.target.value)}
                          placeholder="Optional guidance for reviewers"
                        />
                      </Form.Group>
                    </Col>
                    <Col md={3} className="d-flex align-items-center">
                      <Form.Check
                        type="switch"
                        id={`field-required-${field.id}`}
                        label="Required"
                        checked={field.required}
                        onChange={(event) => handleFieldChange(field.id, 'required', event.target.checked)}
                      />
                    </Col>
                  </Row>
                </Card.Body>
              </Card>
            ))}
          </div>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="outline-secondary" onClick={resetEditor}>
            Cancel
          </Button>
          <Button variant="primary" onClick={() => void handleSave()} disabled={isSubmitting}>
            {isSubmitting ? (
              <span className="d-inline-flex align-items-center gap-2">
                <Spinner animation="border" size="sm" role="status" aria-hidden="true" />
                Saving…
              </span>
            ) : (
              'Save'
            )}
          </Button>
        </Modal.Footer>
      </Modal>

      <Modal show={Boolean(deleteTarget)} onHide={() => setDeleteTarget(null)} centered>
        <Modal.Header closeButton>
          <Modal.Title>Delete dimension</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          Are you sure you want to delete the dimension <strong>{deleteTarget?.label}</strong> ({deleteTarget?.code})?
          Canonical values linked to this dimension must be removed first.
        </Modal.Body>
        <Modal.Footer>
          <Button variant="outline-secondary" onClick={() => setDeleteTarget(null)}>
            Cancel
          </Button>
          <Button variant="danger" onClick={() => void handleDelete()} disabled={isSubmitting}>
            {isSubmitting ? (
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

export default DimensionsPage;
