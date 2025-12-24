import { useEffect, useMemo, useState } from 'react';
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
} from '../components/ui';

import {
  createDimensionRelation,
  createDimensionRelationLink,
  deleteDimensionRelation,
  deleteDimensionRelationLink,
  fetchDimensionRelationLinks,
  fetchDimensionRelations,
  updateDimensionRelation,
} from '../api';
import { useAppState } from '../state/AppStateContext';
import type {
  DimensionRelationCreatePayload,
  DimensionRelationLink,
  DimensionRelationSummary,
  DimensionRelationUpdatePayload,
  ToastMessage,
} from '../types';

interface DimensionRelationsPageProps {
  onToast: (toast: ToastMessage) => void;
}

interface LinkDraft {
  parentId: number | ''; 
  childId: number | '';
}

const DimensionRelationsPage = ({ onToast }: DimensionRelationsPageProps) => {
  const { dimensions, canonicalValues } = useAppState();
  const [relations, setRelations] = useState<DimensionRelationSummary[]>([]);
  const [linksByRelation, setLinksByRelation] = useState<Map<number, DimensionRelationLink[]>>(new Map());
  const [selectedRelationId, setSelectedRelationId] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLinkSubmitting, setIsLinkSubmitting] = useState(false);
  const [linksLoading, setLinksLoading] = useState(false);
  const [showRelationModal, setShowRelationModal] = useState(false);
  const [editingRelation, setEditingRelation] = useState<DimensionRelationSummary | null>(null);
  const [relationDraft, setRelationDraft] = useState<DimensionRelationCreatePayload>({
    label: '',
    parent_dimension_code: '',
    child_dimension_code: '',
    description: '',
  });
  const [linkDraft, setLinkDraft] = useState<LinkDraft>({ parentId: '', childId: '' });
  const [deleteRelationTarget, setDeleteRelationTarget] = useState<DimensionRelationSummary | null>(null);
  const [deleteLinkTarget, setDeleteLinkTarget] = useState<{ relationId: number; linkId: number } | null>(null);

  const dimensionOptions = useMemo(
    () => dimensions.map((dimension) => ({ code: dimension.code, label: dimension.label })),
    [dimensions],
  );

  const selectedRelation = useMemo(
    () => relations.find((relation) => relation.id === selectedRelationId) ?? null,
    [relations, selectedRelationId],
  );

  const parentCandidates = useMemo(() => {
    if (!selectedRelation) {
      return [];
    }
    return canonicalValues.filter((value) => value.dimension === selectedRelation.parent_dimension_code);
  }, [canonicalValues, selectedRelation]);

  const childCandidates = useMemo(() => {
    if (!selectedRelation) {
      return [];
    }
    return canonicalValues.filter((value) => value.dimension === selectedRelation.child_dimension_code);
  }, [canonicalValues, selectedRelation]);

  useEffect(() => {
    const loadRelations = async () => {
      setIsLoading(true);
      try {
        const result = await fetchDimensionRelations();
        setRelations(result);
        if (result.length > 0) {
          setSelectedRelationId(result[0].id);
        } else {
          setSelectedRelationId(null);
        }
      } catch (error: unknown) {
        console.error(error);
        onToast({ type: 'error', content: 'Unable to load dimension relations.' });
      } finally {
        setIsLoading(false);
      }
    };

    void loadRelations();
  }, [onToast]);

  useEffect(() => {
    if (selectedRelationId === null || linksByRelation.has(selectedRelationId)) {
      return;
    }
    const loadLinks = async () => {
      setLinksLoading(true);
      try {
        const links = await fetchDimensionRelationLinks(selectedRelationId);
        setLinksByRelation((prev) => new Map(prev).set(selectedRelationId, links));
      } catch (error: unknown) {
        console.error(error);
        onToast({ type: 'error', content: 'Unable to load relation links.' });
      } finally {
        setLinksLoading(false);
      }
    };

    void loadLinks();
  }, [linksByRelation, onToast, selectedRelationId]);

  const openCreateModal = () => {
    setEditingRelation(null);
    setRelationDraft({ label: '', parent_dimension_code: '', child_dimension_code: '', description: '' });
    setShowRelationModal(true);
  };

  const openEditModal = (relation: DimensionRelationSummary) => {
    setEditingRelation(relation);
    setRelationDraft({
      label: relation.label,
      parent_dimension_code: relation.parent_dimension_code,
      child_dimension_code: relation.child_dimension_code,
      description: relation.description ?? '',
    });
    setShowRelationModal(true);
  };

  const resetRelationModal = () => {
    setShowRelationModal(false);
    setEditingRelation(null);
    setRelationDraft({ label: '', parent_dimension_code: '', child_dimension_code: '', description: '' });
  };

  const handleSaveRelation = async () => {
    if (!relationDraft.label.trim() || !relationDraft.parent_dimension_code || !relationDraft.child_dimension_code) {
      onToast({ type: 'error', content: 'Label, parent dimension, and child dimension are required.' });
      return;
    }

    if (relationDraft.parent_dimension_code === relationDraft.child_dimension_code) {
      onToast({ type: 'error', content: 'Parent and child dimensions must be different.' });
      return;
    }

    setIsSubmitting(true);
    try {
      if (editingRelation) {
        const payload: DimensionRelationUpdatePayload = {
          label: relationDraft.label.trim(),
          description: relationDraft.description?.trim() || undefined,
        };
        const updated = await updateDimensionRelation(editingRelation.id, payload);
        setRelations((prev) => prev.map((relation) => (relation.id === updated.id ? updated : relation)));
        onToast({ type: 'success', content: 'Relation updated.' });
      } else {
        const payload: DimensionRelationCreatePayload = {
          label: relationDraft.label.trim(),
          parent_dimension_code: relationDraft.parent_dimension_code,
          child_dimension_code: relationDraft.child_dimension_code,
          description: relationDraft.description?.trim() || undefined,
        };
        const created = await createDimensionRelation(payload);
        setRelations((prev) => [...prev, created]);
        setSelectedRelationId(created.id);
        onToast({ type: 'success', content: 'Relation created.' });
      }
      resetRelationModal();
    } catch (error: unknown) {
      console.error(error);
      onToast({ type: 'error', content: 'Unable to save relation.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteRelation = async () => {
    if (!deleteRelationTarget) {
      return;
    }
    setIsSubmitting(true);
    try {
      await deleteDimensionRelation(deleteRelationTarget.id);
      setRelations((prev) => {
        const remaining = prev.filter((relation) => relation.id !== deleteRelationTarget.id);
        if (selectedRelationId === deleteRelationTarget.id) {
          setSelectedRelationId(remaining.length ? remaining[0].id : null);
        }
        return remaining;
      });
      setLinksByRelation((prev) => {
        const next = new Map(prev);
        next.delete(deleteRelationTarget.id);
        return next;
      });
      onToast({ type: 'success', content: 'Relation deleted.' });
      setDeleteRelationTarget(null);
    } catch (error: unknown) {
      console.error(error);
      onToast({ type: 'error', content: 'Unable to delete relation.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCreateLink = async () => {
    if (!selectedRelation || !linkDraft.parentId || !linkDraft.childId) {
      onToast({ type: 'error', content: 'Select both parent and child canonical values.' });
      return;
    }

    setIsLinkSubmitting(true);
    try {
      const created = await createDimensionRelationLink(selectedRelation.id, {
        parent_canonical_id: linkDraft.parentId,
        child_canonical_id: linkDraft.childId,
      });
      setLinksByRelation((prev) => {
        const next = new Map(prev);
        const current = next.get(selectedRelation.id) ?? [];
        next.set(selectedRelation.id, [...current, created]);
        return next;
      });
      setRelations((prev) =>
        prev.map((relation) =>
          relation.id === selectedRelation.id
            ? { ...relation, link_count: relation.link_count + 1 }
            : relation,
        ),
      );
      setLinkDraft({ parentId: '', childId: '' });
      onToast({ type: 'success', content: 'Relation link created.' });
    } catch (error: unknown) {
      console.error(error);
      onToast({ type: 'error', content: 'Unable to create relation link.' });
    } finally {
      setIsLinkSubmitting(false);
    }
  };

  const handleDeleteLink = async () => {
    if (!deleteLinkTarget) {
      return;
    }
    setIsLinkSubmitting(true);
    try {
      await deleteDimensionRelationLink(deleteLinkTarget.relationId, deleteLinkTarget.linkId);
      setLinksByRelation((prev) => {
        const next = new Map(prev);
        const current = next.get(deleteLinkTarget.relationId) ?? [];
        next.set(
          deleteLinkTarget.relationId,
          current.filter((link) => link.id !== deleteLinkTarget.linkId),
        );
        return next;
      });
      setRelations((prev) =>
        prev.map((relation) =>
          relation.id === deleteLinkTarget.relationId
            ? { ...relation, link_count: Math.max(relation.link_count - 1, 0) }
            : relation,
        ),
      );
      onToast({ type: 'success', content: 'Relation link deleted.' });
      setDeleteLinkTarget(null);
    } catch (error: unknown) {
      console.error(error);
      onToast({ type: 'error', content: 'Unable to delete relation link.' });
    } finally {
      setIsLinkSubmitting(false);
    }
  };

  const currentLinks = selectedRelationId ? linksByRelation.get(selectedRelationId) ?? [] : [];

  return (
    <div className="flex flex-col gap-4" aria-label="Dimension relations">
      <Card className="card-section">
        <Card.Body className="flex flex-col gap-4">
          <div className="flex flex-col lg:flex-row justify-between lg:items-center gap-3">
            <div>
              <Card.Title as="h1" className="text-2xl mb-1">
                Dimension relationships
              </Card.Title>
              <Card.Text className="text-slate-400 mb-0">
                Model parent-child relationships between dimensions—for example, regions and their districts. Maintain
                canonical value pairings to power drill-downs and validation rules.
              </Card.Text>
            </div>
            <Button variant="primary" onClick={openCreateModal}>
              New relation
            </Button>
          </div>

          {isLoading ? (
            <div className="flex justify-center py-5">
              <Spinner animation="border" role="status" aria-hidden="true" />
            </div>
          ) : relations.length === 0 ? (
            <div className="text-center text-slate-400 py-5">
              <p className="mb-0">No relations defined yet. Create a relation to begin linking canonical values.</p>
            </div>
          ) : (
            <Row className="gap-3">
              {relations.map((relation) => (
                <Col key={relation.id} md={6} xl={4}>
                  <Card
                    className={`h-full ${
                      relation.id === selectedRelationId ? 'border-aurora border-2 shadow-glow-sm' : 'border-0 shadow-glow-sm'
                    }`}
                    onClick={() => setSelectedRelationId(relation.id)}
                    role="button"
                    style={{ cursor: 'pointer' }}
                  >
                    <Card.Body className="flex flex-col gap-3">
                      <div className="flex justify-between items-start gap-3">
                        <div>
                          <Card.Title as="h2" className="text-lg mb-1">
                            {relation.label}
                          </Card.Title>
                          <Card.Text className="text-slate-400 mb-0">
                            {relation.description || 'No description provided.'}
                          </Card.Text>
                        </div>
                        <Badge bg="secondary" pill>
                          {relation.link_count} link{relation.link_count === 1 ? '' : 's'}
                        </Badge>
                      </div>
                      <div className="flex flex-col gap-2">
                        <div className="flex items-center gap-2">
                          <Badge bg="info" text="dark">
                            Parent
                          </Badge>
                          <span>
                            {relation.parent_dimension.label} ({relation.parent_dimension.code})
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge bg="warning" text="dark">
                            Child
                          </Badge>
                          <span>
                            {relation.child_dimension.label} ({relation.child_dimension.code})
                          </span>
                        </div>
                      </div>
                      <div className="flex gap-2 mt-auto">
                        <Button variant="outline-primary" size="sm" onClick={() => openEditModal(relation)}>
                          Edit
                        </Button>
                        <Button variant="outline-danger" size="sm" onClick={() => setDeleteRelationTarget(relation)}>
                          Delete
                        </Button>
                      </div>
                    </Card.Body>
                  </Card>
                </Col>
              ))}
            </Row>
          )}
        </Card.Body>
      </Card>

      {selectedRelation && (
        <Card className="card-section">
          <Card.Body className="flex flex-col gap-4">
            <div className="flex flex-col lg:flex-row justify-between lg:items-center gap-3">
              <div>
                <Card.Title as="h2" className="text-xl mb-1">
                  {selectedRelation.label}
                </Card.Title>
                <Card.Text className="text-slate-400 mb-0">
                  {selectedRelation.parent_dimension.label} ➝ {selectedRelation.child_dimension.label}
                </Card.Text>
              </div>
            </div>

            <Card className="border-0 shadow-glow-sm">
              <Card.Body className="flex flex-col gap-3">
                <h3 className="text-sm font-semibold uppercase tracking-[0.3em] text-slate-400 mb-0">Add link</h3>
                <Row className="gap-3 items-end">
                  <Col md={6}>
                    <Form.Group controlId="relation-parent-select">
                      <Form.Label>Parent canonical value</Form.Label>
                      <Form.Select
                        value={linkDraft.parentId === '' ? '' : String(linkDraft.parentId)}
                        onChange={(event) =>
                          setLinkDraft((prev) => ({
                            ...prev,
                            parentId: event.target.value ? Number(event.target.value) : '',
                          }))
                        }
                      >
                        <option value="">Select parent value</option>
                        {parentCandidates.map((value) => (
                          <option key={value.id} value={value.id}>
                            {value.canonical_label}
                          </option>
                        ))}
                      </Form.Select>
                      {parentCandidates.length === 0 && (
                        <Form.Text className="text-slate-400">
                          No canonical values found for {selectedRelation.parent_dimension.label}. Add values first.
                        </Form.Text>
                      )}
                    </Form.Group>
                  </Col>
                  <Col md={6}>
                    <Form.Group controlId="relation-child-select">
                      <Form.Label>Child canonical value</Form.Label>
                      <Form.Select
                        value={linkDraft.childId === '' ? '' : String(linkDraft.childId)}
                        onChange={(event) =>
                          setLinkDraft((prev) => ({
                            ...prev,
                            childId: event.target.value ? Number(event.target.value) : '',
                          }))
                        }
                      >
                        <option value="">Select child value</option>
                        {childCandidates.map((value) => (
                          <option key={value.id} value={value.id}>
                            {value.canonical_label}
                          </option>
                        ))}
                      </Form.Select>
                      {childCandidates.length === 0 && (
                        <Form.Text className="text-slate-400">
                          No canonical values found for {selectedRelation.child_dimension.label}. Add values first.
                        </Form.Text>
                      )}
                    </Form.Group>
                  </Col>
                </Row>
                <div>
                  <Button
                    variant="primary"
                    onClick={() => void handleCreateLink()}
                    disabled={isLinkSubmitting || parentCandidates.length === 0 || childCandidates.length === 0}
                  >
                    {isLinkSubmitting ? (
                      <span className="inline-flex items-center gap-2">
                        <Spinner animation="border" size="sm" role="status" aria-hidden="true" />
                        Linking…
                      </span>
                    ) : (
                      'Create link'
                    )}
                  </Button>
                </div>
              </Card.Body>
            </Card>

            <div className="overflow-x-auto">
              <Table striped hover className="align-middle whitespace-nowrap">
                <thead>
                  <tr>
                    <th>Parent value</th>
                    <th>Child value</th>
                    <th className="text-end">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {linksLoading ? (
                    <tr>
                      <td colSpan={3} className="text-center py-4">
                        <Spinner animation="border" role="status" aria-hidden="true" />
                      </td>
                    </tr>
                  ) : currentLinks.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="text-center text-slate-400 py-4">
                        No links defined yet for this relation.
                      </td>
                    </tr>
                  ) : (
                    currentLinks.map((link) => (
                      <tr key={link.id}>
                        <td>{link.parent_label}</td>
                        <td>{link.child_label}</td>
                        <td className="text-end">
                          <Button
                            size="sm"
                            variant="outline-danger"
                            onClick={() => setDeleteLinkTarget({ relationId: selectedRelation.id, linkId: link.id })}
                          >
                            Delete
                          </Button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </Table>
            </div>
          </Card.Body>
        </Card>
      )}

      <Modal show={showRelationModal} onHide={resetRelationModal} centered>
        <Modal.Header closeButton>
          <Modal.Title>{editingRelation ? 'Edit relation' : 'New relation'}</Modal.Title>
        </Modal.Header>
        <Modal.Body className="flex flex-col gap-3">
          <Form.Group controlId="relation-label">
            <Form.Label>Label</Form.Label>
            <Form.Control
              type="text"
              value={relationDraft.label}
              onChange={(event) => setRelationDraft((prev) => ({ ...prev, label: event.target.value }))}
              placeholder="e.g. Region to District"
            />
          </Form.Group>
          <Row className="gap-3">
            <Col md={6}>
              <Form.Group controlId="relation-parent-dimension">
                <Form.Label>Parent dimension</Form.Label>
                <Form.Select
                  value={relationDraft.parent_dimension_code}
                  onChange={(event) =>
                    setRelationDraft((prev) => ({ ...prev, parent_dimension_code: event.target.value }))
                  }
                  disabled={Boolean(editingRelation)}
                >
                  <option value="">Select parent dimension</option>
                  {dimensionOptions.map((option) => (
                    <option key={option.code} value={option.code}>
                      {option.label} ({option.code})
                    </option>
                  ))}
                </Form.Select>
              </Form.Group>
            </Col>
            <Col md={6}>
              <Form.Group controlId="relation-child-dimension">
                <Form.Label>Child dimension</Form.Label>
                <Form.Select
                  value={relationDraft.child_dimension_code}
                  onChange={(event) =>
                    setRelationDraft((prev) => ({ ...prev, child_dimension_code: event.target.value }))
                  }
                  disabled={Boolean(editingRelation)}
                >
                  <option value="">Select child dimension</option>
                  {dimensionOptions.map((option) => (
                    <option key={option.code} value={option.code}>
                      {option.label} ({option.code})
                    </option>
                  ))}
                </Form.Select>
              </Form.Group>
            </Col>
          </Row>
          <Form.Group controlId="relation-description">
            <Form.Label>Description</Form.Label>
            <Form.Control
              as="textarea"
              rows={3}
              value={relationDraft.description ?? ''}
              onChange={(event) => setRelationDraft((prev) => ({ ...prev, description: event.target.value }))}
              placeholder="Optional description for analysts"
            />
          </Form.Group>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="outline-secondary" onClick={resetRelationModal}>
            Cancel
          </Button>
          <Button variant="primary" onClick={() => void handleSaveRelation()} disabled={isSubmitting}>
            {isSubmitting ? (
              <span className="inline-flex items-center gap-2">
                <Spinner animation="border" size="sm" role="status" aria-hidden="true" />
                Saving…
              </span>
            ) : (
              'Save'
            )}
          </Button>
        </Modal.Footer>
      </Modal>

      <Modal show={Boolean(deleteRelationTarget)} onHide={() => setDeleteRelationTarget(null)} centered>
        <Modal.Header closeButton>
          <Modal.Title>Delete relation</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          Delete the relation <strong>{deleteRelationTarget?.label}</strong>? This removes all links between
          {deleteRelationTarget && (
            <>
              {' '}
              <strong>{deleteRelationTarget.parent_dimension.label}</strong> and{' '}
              <strong>{deleteRelationTarget.child_dimension.label}</strong> values.
            </>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="outline-secondary" onClick={() => setDeleteRelationTarget(null)}>
            Cancel
          </Button>
          <Button variant="danger" onClick={() => void handleDeleteRelation()} disabled={isSubmitting}>
            {isSubmitting ? (
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

      <Modal show={Boolean(deleteLinkTarget)} onHide={() => setDeleteLinkTarget(null)} centered>
        <Modal.Header closeButton>
          <Modal.Title>Delete relation link</Modal.Title>
        </Modal.Header>
        <Modal.Body>Remove this parent-child pairing from the relation?</Modal.Body>
        <Modal.Footer>
          <Button variant="outline-secondary" onClick={() => setDeleteLinkTarget(null)}>
            Cancel
          </Button>
          <Button variant="danger" onClick={() => void handleDeleteLink()} disabled={isLinkSubmitting}>
            {isLinkSubmitting ? (
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

export default DimensionRelationsPage;
