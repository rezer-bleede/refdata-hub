import { useMemo, useState } from 'react';
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
  createCanonicalValue,
  deleteCanonicalValue,
  updateCanonicalValue,
} from '../api';
import { useAppState } from '../state/AppStateContext';
import type {
  CanonicalValue,
  CanonicalValueUpdatePayload,
  ToastMessage,
} from '../types';

interface CanonicalLibraryPageProps {
  onToast: (toast: ToastMessage) => void;
}

interface BulkEntry {
  dimension: string;
  canonical_label: string;
  description?: string;
}

function parseBulkEntries(raw: string, fallbackDimension: string): BulkEntry[] {
  const lines = raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !/^#/.test(line));

  const entries: BulkEntry[] = [];

  for (const line of lines) {
    const parts = line
      .split(/\t|\s{2,}|,/)
      .map((part) => part.trim())
      .filter((part) => part.length > 0);

    if (parts.length < 2) {
      continue;
    }

    let [dimension, label, ...rest] = parts;

    if (!dimension && fallbackDimension) {
      dimension = fallbackDimension;
    }

    if (!dimension || !label) {
      continue;
    }

    const description = rest.length ? rest.join(' — ') : undefined;

    entries.push({
      dimension,
      canonical_label: label,
      description,
    });
  }

  return entries;
}

function buildCsv(rows: CanonicalValue[]): string {
  const header = ['Dimension', 'Canonical Label', 'Description'];
  const encodedRows = rows.map((row) => [row.dimension, row.canonical_label, row.description ?? '']);
  return [header, ...encodedRows]
    .map((columns) =>
      columns
        .map((column) => {
          const value = column.replaceAll('"', '""');
          return `"${value}"`;
        })
        .join(','),
    )
    .join('\n');
}

const CanonicalLibraryPage = ({ onToast }: CanonicalLibraryPageProps) => {
  const { canonicalValues, updateCanonicalValues } = useAppState();
  const [searchTerm, setSearchTerm] = useState('');
  const [dimensionFilter, setDimensionFilter] = useState('all');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showEditor, setShowEditor] = useState(false);
  const [editorDraft, setEditorDraft] = useState<CanonicalValueUpdatePayload>({});
  const [editingTarget, setEditingTarget] = useState<CanonicalValue | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CanonicalValue | null>(null);
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [bulkDimension, setBulkDimension] = useState('');
  const [bulkText, setBulkText] = useState('');

  const dimensions = useMemo(() => {
    return Array.from(new Set(canonicalValues.map((value) => value.dimension))).sort();
  }, [canonicalValues]);

  const filteredValues = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    return canonicalValues.filter((value) => {
      const dimensionMatch = dimensionFilter === 'all' || value.dimension === dimensionFilter;
      if (!dimensionMatch) return false;
      if (!query) return true;
      return (
        value.canonical_label.toLowerCase().includes(query) ||
        value.dimension.toLowerCase().includes(query) ||
        (value.description ?? '').toLowerCase().includes(query)
      );
    });
  }, [canonicalValues, dimensionFilter, searchTerm]);

  const openCreateModal = () => {
    setEditingTarget(null);
    setEditorDraft({ dimension: '', canonical_label: '', description: '' });
    setShowEditor(true);
  };

  const openEditModal = (value: CanonicalValue) => {
    setEditingTarget(value);
    setEditorDraft({
      dimension: value.dimension,
      canonical_label: value.canonical_label,
      description: value.description ?? '',
    });
    setShowEditor(true);
  };

  const handleEditorSubmit = async () => {
    if (!editorDraft.dimension || !editorDraft.canonical_label) {
      onToast({ type: 'error', content: 'Dimension and canonical label are required.' });
      return;
    }

    setIsSubmitting(true);
    try {
      if (editingTarget) {
        const updated = await updateCanonicalValue(editingTarget.id, editorDraft);
        updateCanonicalValues((prev) =>
          prev.map((item) => (item.id === updated.id ? updated : item)),
        );
        onToast({ type: 'success', content: 'Canonical value updated.' });
      } else {
        const created = await createCanonicalValue(editorDraft as CanonicalValueUpdatePayload);
        updateCanonicalValues((prev) => [...prev, created]);
        onToast({ type: 'success', content: 'Canonical value created.' });
      }
      setShowEditor(false);
    } catch (error: unknown) {
      console.error(error);
      onToast({ type: 'error', content: 'Unable to save canonical value.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
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
    const csv = buildCsv(filteredValues);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'canonical-values.csv';
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const handleBulkImport = async () => {
    if (!bulkText.trim()) {
      onToast({ type: 'error', content: 'Paste canonical rows to import.' });
      return;
    }

    const entries = parseBulkEntries(bulkText, bulkDimension);

    if (!entries.length) {
      onToast({ type: 'error', content: 'No valid rows detected. Ensure each row has at least a dimension and label.' });
      return;
    }

    setIsSubmitting(true);
    try {
      const created: CanonicalValue[] = [];
      for (const entry of entries) {
        const canonical = await createCanonicalValue(entry);
        created.push(canonical);
      }
      if (created.length) {
        updateCanonicalValues((prev) => [...prev, ...created]);
      }
      onToast({ type: 'success', content: `Imported ${created.length} canonical value(s).` });
      setShowBulkModal(false);
      setBulkText('');
      setBulkDimension('');
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
                Curate golden records across every dimension. Use filters to focus on a single taxonomy or search by keyword.
              </Card.Text>
            </div>
            <div className="d-flex flex-wrap gap-2">
              <Button variant="primary" onClick={openCreateModal}>
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
                  {dimensions.map((dimension) => (
                    <option key={dimension} value={dimension}>
                      {dimension}
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
                    placeholder="Search by label, dimension, or description"
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
                  <th className="text-end">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredValues.length === 0 && (
                  <tr>
                    <td colSpan={4} className="text-center text-body-secondary py-4">
                      No canonical values match the current filters.
                    </td>
                  </tr>
                )}
                {filteredValues.map((value) => (
                  <tr key={value.id}>
                    <td className="fw-semibold">{value.canonical_label}</td>
                    <td>
                      <Badge bg="info" text="dark">
                        {value.dimension}
                      </Badge>
                    </td>
                    <td>{value.description || '—'}</td>
                    <td className="text-end">
                      <div className="d-inline-flex gap-2">
                        <Button
                          size="sm"
                          variant="outline-primary"
                          onClick={() => openEditModal(value)}
                        >
                          Edit
                        </Button>
                        <Button
                          size="sm"
                          variant="outline-danger"
                          onClick={() => setDeleteTarget(value)}
                        >
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

      <Modal show={showEditor} onHide={() => setShowEditor(false)} backdrop="static" centered>
        <Modal.Header closeButton>
          <Modal.Title>{editingTarget ? 'Edit canonical value' : 'New canonical value'}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form className="d-flex flex-column gap-3">
            <Form.Group controlId="editor-dimension">
              <Form.Label>Dimension</Form.Label>
              <Form.Control
                type="text"
                placeholder="e.g. region"
                value={editorDraft.dimension ?? ''}
                onChange={(event) =>
                  setEditorDraft((draft) => ({ ...draft, dimension: event.target.value }))
                }
                required
              />
            </Form.Group>
            <Form.Group controlId="editor-label">
              <Form.Label>Canonical label</Form.Label>
              <Form.Control
                type="text"
                value={editorDraft.canonical_label ?? ''}
                onChange={(event) =>
                  setEditorDraft((draft) => ({ ...draft, canonical_label: event.target.value }))
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
                  setEditorDraft((draft) => ({ ...draft, description: event.target.value }))
                }
              />
            </Form.Group>
          </Form>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="outline-secondary" onClick={() => setShowEditor(false)}>
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
          Are you sure you want to delete “{deleteTarget?.canonical_label}” from the
          {' '}
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

      <Modal show={showBulkModal} onHide={() => setShowBulkModal(false)} size="lg" centered>
        <Modal.Header closeButton>
          <Modal.Title>Bulk import canonical values</Modal.Title>
        </Modal.Header>
        <Modal.Body className="d-flex flex-column gap-3">
          <p className="mb-0 text-body-secondary">
            Paste tab- or comma-separated rows. The importer expects columns in the order
            {' '}
            <code>dimension</code>, <code>canonical label</code>, and optional description fields (such as codes or translations).
            Empty dimension cells inherit the default dimension below.
          </p>
          <Form.Group controlId="bulk-dimension">
            <Form.Label>Default dimension (optional)</Form.Label>
            <Form.Control
              type="text"
              placeholder="Use when the pasted rows omit a dimension column"
              value={bulkDimension}
              onChange={(event) => setBulkDimension(event.target.value)}
            />
          </Form.Group>
          <Form.Group controlId="bulk-rows">
            <Form.Label>Rows to import</Form.Label>
            <Form.Control
              as="textarea"
              rows={10}
              placeholder={`Example:\nregion\tAbu Dhabi Emirate\tCode 01\tإمارة أبوظبي`}
              value={bulkText}
              onChange={(event) => setBulkText(event.target.value)}
            />
          </Form.Group>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="outline-secondary" onClick={() => setShowBulkModal(false)}>
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
