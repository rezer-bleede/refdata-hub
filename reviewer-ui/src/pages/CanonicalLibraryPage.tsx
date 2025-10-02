import { ChangeEvent, useEffect, useMemo, useState } from 'react';
import {
  Badge,
  Button,
  Card,
  Col,
  Form,
  InputGroup,
  Modal,
  Row,
  Spinner,
  Table,
} from 'react-bootstrap';

import {
  bulkImportCanonicalValues,
  createCanonicalValue,
  deleteCanonicalValue,
  updateCanonicalValue,
} from '../api';
import { useAppState } from '../state/AppStateContext';
import type {
  CanonicalValue,
  CanonicalValueUpdatePayload,
  DimensionDefinition,
  ToastMessage,
} from '../types';

interface CanonicalLibraryPageProps {
  onToast: (toast: ToastMessage) => void;
}

interface DimensionOption {
  code: string;
  label: string;
}

interface AttributeDraft {
  [key: string]: string;
}

const formatAttributeValue = (value: unknown): string => {
  if (value === null || value === undefined || value === '') {
    return '—';
  }
  if (typeof value === 'boolean') {
    return value ? 'Yes' : 'No';
  }
  return String(value);
};

const buildCsv = (
  rows: CanonicalValue[],
  dimensionMap: Map<string, DimensionDefinition>,
): string => {
  const attributeKeys = new Set<string>();

  rows.forEach((row) => {
    const definition = dimensionMap.get(row.dimension);
    if (definition) {
      definition.extra_fields.forEach((field) => attributeKeys.add(field.key));
    } else if (row.attributes) {
      Object.keys(row.attributes).forEach((key) => attributeKeys.add(key));
    }
  });

  const sortedAttributeKeys = Array.from(attributeKeys).sort();
  const header = ['Dimension', 'Canonical Label', 'Description', ...sortedAttributeKeys];

  const encodedRows = rows.map((row) => {
    const dimension = row.dimension;
    const label = row.canonical_label;
    const description = row.description ?? '';
    const attributes = sortedAttributeKeys.map((key) => {
      const value = row.attributes?.[key];
      return value === null || value === undefined ? '' : String(value);
    });
    return [dimension, label, description, ...attributes];
  });

  return [header, ...encodedRows]
    .map((columns) =>
      columns
        .map((column) => {
          const safe = column.replaceAll('"', '""');
          return `"${safe}"`;
        })
        .join(','),
    )
    .join('\n');
};

const CanonicalLibraryPage = ({ onToast }: CanonicalLibraryPageProps) => {
  const { canonicalValues, dimensions, updateCanonicalValues } = useAppState();
  const [searchTerm, setSearchTerm] = useState('');
  const [dimensionFilter, setDimensionFilter] = useState('all');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showEditor, setShowEditor] = useState(false);
  const [editorDraft, setEditorDraft] = useState<CanonicalValueUpdatePayload>({
    dimension: '',
    canonical_label: '',
    description: '',
  });
  const [editorAttributes, setEditorAttributes] = useState<AttributeDraft>({});
  const [editingTarget, setEditingTarget] = useState<CanonicalValue | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CanonicalValue | null>(null);
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [bulkDimension, setBulkDimension] = useState('');
  const [bulkText, setBulkText] = useState('');
  const [bulkFile, setBulkFile] = useState<File | null>(null);
  const [bulkErrors, setBulkErrors] = useState<string[]>([]);

  const dimensionMap = useMemo(
    () => new Map(dimensions.map((dimension) => [dimension.code, dimension])),
    [dimensions],
  );

  const dimensionOptions = useMemo<DimensionOption[]>(() => {
    const lookup = new Map<string, string>();
    dimensions.forEach((dimension) => {
      lookup.set(dimension.code, dimension.label);
    });
    canonicalValues.forEach((value) => {
      if (!lookup.has(value.dimension)) {
        lookup.set(value.dimension, value.dimension);
      }
    });
    return Array.from(lookup.entries())
      .map(([code, label]) => ({ code, label }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [canonicalValues, dimensions]);

  const filteredValues = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    return canonicalValues.filter((value) => {
      const matchesDimension = dimensionFilter === 'all' || value.dimension === dimensionFilter;
      if (!matchesDimension) {
        return false;
      }

      if (!query) {
        return true;
      }

      const dimensionLabel = dimensionMap.get(value.dimension)?.label.toLowerCase() ?? '';
      const attributesText = Object.entries(value.attributes ?? {})
        .map(([, attrValue]) => (attrValue === null || attrValue === undefined ? '' : String(attrValue).toLowerCase()))
        .join(' ');

      return (
        value.canonical_label.toLowerCase().includes(query) ||
        value.dimension.toLowerCase().includes(query) ||
        dimensionLabel.includes(query) ||
        (value.description ?? '').toLowerCase().includes(query) ||
        attributesText.includes(query)
      );
    });
  }, [canonicalValues, dimensionFilter, dimensionMap, searchTerm]);

  const selectedDimension = editorDraft.dimension ? dimensionMap.get(editorDraft.dimension) : undefined;

  useEffect(() => {
    if (!showEditor) {
      return;
    }
    if (!selectedDimension) {
      setEditorAttributes({});
      return;
    }
    setEditorAttributes((prev) => {
      const next: AttributeDraft = {};
      selectedDimension.extra_fields.forEach((field) => {
        if (field.data_type === 'boolean') {
          const current = prev[field.key];
          next[field.key] = current && ['true', 'false'].includes(current) ? current : 'unset';
        } else {
          next[field.key] = prev[field.key] ?? '';
        }
      });
      return next;
    });
  }, [selectedDimension, showEditor]);

  const closeEditor = () => {
    setShowEditor(false);
    setEditorDraft({ dimension: dimensions[0]?.code ?? '', canonical_label: '', description: '' });
    setEditorAttributes({});
    setEditingTarget(null);
  };

  const openCreateModal = () => {
    const defaultDimension = dimensions[0]?.code ?? '';
    setEditingTarget(null);
    setEditorDraft({ dimension: defaultDimension, canonical_label: '', description: '' });
    setEditorAttributes({});
    setShowEditor(true);
  };

  const openEditModal = (value: CanonicalValue) => {
    setEditingTarget(value);
    setEditorDraft({
      dimension: value.dimension,
      canonical_label: value.canonical_label,
      description: value.description ?? '',
    });

    const dimension = dimensionMap.get(value.dimension);
    if (dimension) {
      const attributes: AttributeDraft = {};
      dimension.extra_fields.forEach((field) => {
        const rawValue = value.attributes?.[field.key];
        if (field.data_type === 'boolean') {
          if (rawValue === true) {
            attributes[field.key] = 'true';
          } else if (rawValue === false) {
            attributes[field.key] = 'false';
          } else {
            attributes[field.key] = 'unset';
          }
        } else if (rawValue === null || rawValue === undefined) {
          attributes[field.key] = '';
        } else {
          attributes[field.key] = String(rawValue);
        }
      });
      setEditorAttributes(attributes);
    } else {
      setEditorAttributes({});
    }

    setShowEditor(true);
  };

  const handleEditorSubmit = async () => {
    if (!editorDraft.dimension || !editorDraft.canonical_label) {
      onToast({ type: 'error', content: 'Dimension and canonical label are required.' });
      return;
    }

    const dimensionDefinition = dimensionMap.get(editorDraft.dimension);
    const attributePayload: Record<string, string | number | boolean | null> | undefined = (() => {
      if (!dimensionDefinition || dimensionDefinition.extra_fields.length === 0) {
        return dimensionDefinition ? {} : undefined;
      }
      const next: Record<string, string | number | boolean | null> = {};

      for (const field of dimensionDefinition.extra_fields) {
        const raw = editorAttributes[field.key] ?? '';

        if (field.data_type === 'boolean') {
          if (raw === 'true') {
            next[field.key] = true;
          } else if (raw === 'false') {
            next[field.key] = false;
          } else if (field.required) {
            onToast({ type: 'error', content: `Set a value for ${field.label}.` });
            return undefined;
          } else {
            next[field.key] = null;
          }
        } else if (field.data_type === 'number') {
          if (raw === '') {
            if (field.required) {
              onToast({ type: 'error', content: `Set a numeric value for ${field.label}.` });
              return undefined;
            }
            next[field.key] = null;
          } else {
            const numeric = Number(raw);
            if (Number.isNaN(numeric)) {
              onToast({ type: 'error', content: `${field.label} must be a number.` });
              return undefined;
            }
            next[field.key] = numeric;
          }
        } else {
          if (!raw) {
            if (field.required) {
              onToast({ type: 'error', content: `Set a value for ${field.label}.` });
              return undefined;
            }
            next[field.key] = null;
          } else {
            next[field.key] = raw;
          }
        }
      }

      return next;
    })();

    if (attributePayload === undefined && selectedDimension?.extra_fields.length) {
      return;
    }

    setIsSubmitting(true);
    const payload: CanonicalValueUpdatePayload = {
      dimension: editorDraft.dimension,
      canonical_label: editorDraft.canonical_label,
      description: editorDraft.description ?? '',
      attributes: attributePayload,
    };

    try {
      if (editingTarget) {
        const updated = await updateCanonicalValue(editingTarget.id, payload);
        updateCanonicalValues((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
        onToast({ type: 'success', content: 'Canonical value updated.' });
      } else {
        const created = await createCanonicalValue(payload);
        updateCanonicalValues((prev) => [...prev, created]);
        onToast({ type: 'success', content: 'Canonical value created.' });
      }
      closeEditor();
    } catch (error: unknown) {
      console.error(error);
      onToast({ type: 'error', content: 'Unable to save canonical value.' });
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
      await deleteCanonicalValue(deleteTarget.id);
      updateCanonicalValues((prev) => prev.filter((item) => item.id !== deleteTarget.id));
      onToast({ type: 'success', content: 'Canonical value removed.' });
      setDeleteTarget(null);
    } catch (error: unknown) {
      console.error(error);
      onToast({ type: 'error', content: 'Unable to delete canonical value.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleExport = () => {
    const csv = buildCsv(filteredValues, dimensionMap);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'canonical-values.csv';
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const closeBulkModal = () => {
    setShowBulkModal(false);
    setBulkDimension('');
    setBulkText('');
    setBulkFile(null);
    setBulkErrors([]);
  };

  const handleBulkImport = async () => {
    if (!bulkFile && !bulkText.trim()) {
      onToast({ type: 'error', content: 'Select a file or paste rows to import.' });
      return;
    }

    const formData = new FormData();
    if (bulkFile) {
      formData.append('file', bulkFile);
    }
    if (bulkText.trim()) {
      formData.append('inline_text', bulkText.trim());
    }
    if (bulkDimension.trim()) {
      formData.append('dimension', bulkDimension.trim());
    }

    setIsSubmitting(true);
    try {
      const result = await bulkImportCanonicalValues(formData);
      if (result.created.length) {
        updateCanonicalValues((prev) => [...prev, ...result.created]);
      }

      if (result.errors.length) {
        setBulkErrors(result.errors);
        onToast({
          type: 'error',
          content: `Imported ${result.created.length} value(s) with ${result.errors.length} error(s).`,
        });
      } else {
        onToast({ type: 'success', content: `Imported ${result.created.length} canonical value(s).` });
        closeBulkModal();
      }
    } catch (error: unknown) {
      console.error(error);
      onToast({ type: 'error', content: 'Unable to import canonical values.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="d-flex flex-column gap-4" aria-label="Canonical library">
      <Card className="card-section">
        <Card.Body className="d-flex flex-column gap-4">
          <div className="d-flex flex-column flex-lg-row justify-content-between align-items-lg-center gap-3">
            <div>
              <Card.Title as="h1" className="section-heading h4 mb-1">
                Canonical library
              </Card.Title>
              <Card.Text className="text-body-secondary mb-0">
                Curate golden records across every dimension. Use filters to focus on a single taxonomy, manage
                dimension-specific attributes, or search by keyword.
              </Card.Text>
            </div>
            <div className="d-flex flex-wrap gap-2">
              <Button variant="primary" onClick={openCreateModal} disabled={dimensions.length === 0}>
                New canonical value
              </Button>
              <Button variant="outline-primary" onClick={() => setShowBulkModal(true)}>
                Bulk import
              </Button>
              <Button variant="outline-secondary" onClick={handleExport}>
                Export CSV
              </Button>
            </div>
          </div>

          <Row className="g-3">
            <Col md={4}>
              <Form.Group controlId="dimension-filter">
                <Form.Label>Dimension</Form.Label>
                <Form.Select value={dimensionFilter} onChange={(event) => setDimensionFilter(event.target.value)}>
                  <option value="all">All dimensions</option>
                  {dimensionOptions.map((option) => (
                    <option key={option.code} value={option.code}>
                      {option.label} ({option.code})
                    </option>
                  ))}
                </Form.Select>
              </Form.Group>
            </Col>
            <Col md={8}>
              <Form.Group controlId="search-canonical">
                <Form.Label>Search</Form.Label>
                <InputGroup>
                  <InputGroup.Text>🔍</InputGroup.Text>
                  <Form.Control
                    type="search"
                    placeholder="Search by label, dimension, description, or attribute"
                    value={searchTerm}
                    onChange={(event) => setSearchTerm(event.target.value)}
                  />
                </InputGroup>
              </Form.Group>
            </Col>
          </Row>

          <div className="table-responsive">
            <Table striped hover className="align-middle table-nowrap">
              <thead>
                <tr>
                  <th>Canonical label</th>
                  <th>Dimension</th>
                  <th>Description</th>
                  <th>Attributes</th>
                  <th className="text-end">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredValues.length === 0 && (
                  <tr>
                    <td colSpan={5} className="text-center text-body-secondary py-4">
                      No canonical values match the current filters.
                    </td>
                  </tr>
                )}
                {filteredValues.map((value) => {
                  const dimension = dimensionMap.get(value.dimension);
                  const attributeEntries = dimension?.extra_fields ?? [];
                  return (
                    <tr key={value.id}>
                      <td className="fw-semibold">{value.canonical_label}</td>
                      <td>
                        <Badge bg="info" text="dark">
                          {dimension ? `${dimension.label} (${dimension.code})` : value.dimension}
                        </Badge>
                      </td>
                      <td>{value.description || '—'}</td>
                      <td>
                        {attributeEntries.length === 0 ? (
                          '—'
                        ) : (
                          <div className="d-flex flex-column gap-1">
                            {attributeEntries.map((field) => (
                              <div key={field.key} className="small text-body-secondary">
                                <strong>{field.label}:</strong> {formatAttributeValue(value.attributes?.[field.key])}
                              </div>
                            ))}
                          </div>
                        )}
                      </td>
                      <td className="text-end">
                        <div className="d-inline-flex gap-2">
                          <Button size="sm" variant="outline-primary" onClick={() => openEditModal(value)}>
                            Edit
                          </Button>
                          <Button size="sm" variant="outline-danger" onClick={() => setDeleteTarget(value)}>
                            Delete
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
          </div>
        </Card.Body>
      </Card>

      <Modal show={showEditor} onHide={closeEditor} backdrop="static" centered>
        <Modal.Header closeButton>
          <Modal.Title>{editingTarget ? 'Edit canonical value' : 'New canonical value'}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form className="d-flex flex-column gap-3">
            <Form.Group controlId="editor-dimension">
              <Form.Label>Dimension</Form.Label>
              <Form.Select
                value={editorDraft.dimension ?? ''}
                onChange={(event) =>
                  setEditorDraft((draft) => ({
                    ...draft,
                    dimension: event.target.value,
                  }))
                }
              >
                <option value="" disabled>
                  Select a dimension
                </option>
                {dimensionOptions.map((option) => (
                  <option key={option.code} value={option.code}>
                    {option.label} ({option.code})
                  </option>
                ))}
              </Form.Select>
            </Form.Group>
            <Form.Group controlId="editor-label">
              <Form.Label>Canonical label</Form.Label>
              <Form.Control
                type="text"
                value={editorDraft.canonical_label ?? ''}
                onChange={(event) =>
                  setEditorDraft((draft) => ({
                    ...draft,
                    canonical_label: event.target.value,
                  }))
                }
                required
              />
            </Form.Group>
            <Form.Group controlId="editor-description">
              <Form.Label>Description</Form.Label>
              <Form.Control
                as="textarea"
                rows={3}
                placeholder="Optional description"
                value={editorDraft.description ?? ''}
                onChange={(event) =>
                  setEditorDraft((draft) => ({
                    ...draft,
                    description: event.target.value,
                  }))
                }
              />
            </Form.Group>

            {selectedDimension && selectedDimension.extra_fields.length > 0 && (
              <div className="d-flex flex-column gap-3">
                <div>
                  <h2 className="h6 mb-1">Dimension attributes</h2>
                  <p className="text-body-secondary mb-0">
                    Capture additional metadata unique to the {selectedDimension.label.toLowerCase()} dimension.
                  </p>
                </div>
                {selectedDimension.extra_fields.map((field) => (
                  <Form.Group controlId={`attribute-${field.key}`} key={field.key}>
                    <Form.Label>{field.label}</Form.Label>
                    {field.data_type === 'boolean' ? (
                      <Form.Select
                        value={editorAttributes[field.key] ?? 'unset'}
                        onChange={(event) =>
                          setEditorAttributes((prev) => ({
                            ...prev,
                            [field.key]: event.target.value,
                          }))
                        }
                      >
                        <option value="unset">Not set</option>
                        <option value="true">Yes</option>
                        <option value="false">No</option>
                      </Form.Select>
                    ) : (
                      <Form.Control
                        type={field.data_type === 'number' ? 'number' : 'text'}
                        value={editorAttributes[field.key] ?? ''}
                        onChange={(event) =>
                          setEditorAttributes((prev) => ({
                            ...prev,
                            [field.key]: event.target.value,
                          }))
                        }
                      />
                    )}
                    {field.description && (
                      <Form.Text className="text-body-secondary">{field.description}</Form.Text>
                    )}
                  </Form.Group>
                ))}
              </div>
            )}
          </Form>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="outline-secondary" onClick={closeEditor}>
            Cancel
          </Button>
          <Button variant="primary" onClick={() => void handleEditorSubmit()} disabled={isSubmitting}>
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
          <Modal.Title>Delete canonical value</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          Are you sure you want to delete “{deleteTarget?.canonical_label}” from the{' '}
          <strong>{deleteTarget?.dimension}</strong> dimension?
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

      <Modal show={showBulkModal} onHide={closeBulkModal} size="lg" centered>
        <Modal.Header closeButton>
          <Modal.Title>Bulk import canonical values</Modal.Title>
        </Modal.Header>
        <Modal.Body className="d-flex flex-column gap-3">
          <p className="mb-0 text-body-secondary">
            Upload a CSV or Excel file, or paste tabular rows. Columns are detected automatically—include headers for
            <code>dimension</code>, <code>label</code>, descriptions, and any additional dimension attributes.
          </p>
          <Form.Group controlId="bulk-file">
            <Form.Label>Upload file</Form.Label>
            <Form.Control
              type="file"
              accept=".csv,.tsv,.txt,.xls,.xlsx"
              onChange={(event: ChangeEvent<HTMLInputElement>) => {
                const file = event.target.files?.[0] ?? null;
                setBulkFile(file);
              }}
            />
            <Form.Text className="text-body-secondary">
              Provide CSV, TSV, or Excel documents. When both a file and pasted rows are supplied, the file takes
              precedence.
            </Form.Text>
          </Form.Group>
          <Form.Group controlId="bulk-dimension">
            <Form.Label>Default dimension (optional)</Form.Label>
            <Form.Control
              type="text"
              placeholder="Used when rows omit the dimension column"
              value={bulkDimension}
              onChange={(event) => setBulkDimension(event.target.value)}
            />
          </Form.Group>
          <Form.Group controlId="bulk-rows">
            <Form.Label>Rows to import</Form.Label>
            <Form.Control
              as="textarea"
              rows={8}
              placeholder={`Example:\ndimension,label,code\nregion,Abu Dhabi Emirate,01\n,Al Ain Region,01-1`}
              value={bulkText}
              onChange={(event) => setBulkText(event.target.value)}
            />
          </Form.Group>
          {bulkErrors.length > 0 && (
            <div className="alert alert-warning mb-0" role="alert">
              <h2 className="h6">Import issues</h2>
              <ul className="mb-0">
                {bulkErrors.map((error, index) => (
                  <li key={`${error}-${index}`}>{error}</li>
                ))}
              </ul>
            </div>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="outline-secondary" onClick={closeBulkModal}>
            Cancel
          </Button>
          <Button variant="primary" onClick={() => void handleBulkImport()} disabled={isSubmitting}>
            {isSubmitting ? (
              <span className="d-inline-flex align-items-center gap-2">
                <Spinner animation="border" size="sm" role="status" aria-hidden="true" />
                Importing…
              </span>
            ) : (
              'Import rows'
            )}
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default CanonicalLibraryPage;
