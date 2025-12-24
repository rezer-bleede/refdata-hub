import { Fragment, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import {
  createDimension,
  deleteDimension,
  fetchDimensions,
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

const DimensionsPage = ({ onToast }: DimensionsPageProps) => {
  const { dimensions, updateDimensions } = useAppState();
  const navigate = useNavigate();
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

  const refreshDimensions = async () => {
    const next = await fetchDimensions();
    updateDimensions(next);
  };

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

    return {
      code: draft.code.trim(),
      label: draft.label.trim(),
      description: draft.description?.trim() || undefined,
      extra_fields: normalisedFields,
    };
  };

  const handleSave = async () => {
    const payload = buildPayload();
    if (!payload) return;

    setIsSubmitting(true);
    try {
      if (editing) {
        await updateDimension(editing.code, payload as DimensionUpdatePayload);
        onToast({ type: 'success', content: 'Dimension updated.' });
      } else {
        await createDimension(payload as DimensionCreatePayload);
        onToast({ type: 'success', content: 'Dimension created.' });
      }
      await refreshDimensions();
      resetEditor();
    } catch (error: unknown) {
      console.error(error);
      onToast({ type: 'error', content: 'Unable to save dimension.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setIsSubmitting(true);
    try {
      await deleteDimension(deleteTarget.code);
      await refreshDimensions();
      setDeleteTarget(null);
      onToast({ type: 'success', content: 'Dimension deleted.' });
    } catch (error: unknown) {
      console.error(error);
      onToast({ type: 'error', content: 'Unable to delete dimension.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Fragment>
      <div className="flex flex-col gap-8">
        <section className="surface-card flex flex-col gap-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-1">
              <h1 className="section-heading text-2xl">Semantic dimensions</h1>
              <p className="text-sm text-slate-400">
                Curate reusable data domains with consistent canonical attributes and governance metadata.
              </p>
            </div>
            <button type="button" className="button-primary" onClick={openCreateModal}>
              New dimension
            </button>
          </div>
          <div className="overflow-hidden rounded-3xl border border-slate-800/70">
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th className="px-4 py-3 text-left">Code</th>
                    <th className="px-4 py-3 text-left">Label</th>
                    <th className="px-4 py-3 text-left">Description</th>
                    <th className="px-4 py-3 text-left">Attributes</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedDimensions.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-4 py-6 text-center text-sm text-slate-400">
                        No dimensions defined yet.
                      </td>
                    </tr>
                  )}
                  {sortedDimensions.map((dimension) => (
                    <tr
                      key={dimension.code}
                      className="cursor-pointer bg-slate-900/40 transition hover:bg-slate-800/60"
                      onClick={() => navigate(`/dimensions/${encodeURIComponent(dimension.code)}`)}
                    >
                      <td className="px-4 py-3 font-mono text-sm text-aurora">{dimension.code}</td>
                      <td className="px-4 py-3 text-slate-100">{dimension.label}</td>
                      <td className="px-4 py-3 text-sm text-slate-400">{dimension.description || '—'}</td>
                      <td className="px-4 py-3 text-sm text-slate-300">
                        {dimension.extra_fields.length === 0 ? (
                          <span className="text-slate-500">—</span>
                        ) : (
                          <div className="flex flex-wrap gap-2">
                            {dimension.extra_fields.map((field) => (
                              <span key={field.key} className="badge-pill text-xs">
                                {field.label} · {renderFieldTypeLabel(field.data_type)}
                                {field.required ? ' · required' : ''}
                              </span>
                            ))}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            className="button-secondary text-xs"
                            onClick={(event) => {
                              event.stopPropagation();
                              openEditModal(dimension);
                            }}
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            className="button-danger text-xs"
                            onClick={(event) => {
                              event.stopPropagation();
                              setDeleteTarget(dimension);
                            }}
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      </div>

      {showEditor && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="dimension-editor-title">
          <div className="modal-panel relative max-w-3xl">
            <h3 id="dimension-editor-title" className="modal-title">
              {editing ? 'Edit dimension' : 'New dimension'}
            </h3>
            <button type="button" className="modal-close" onClick={resetEditor} aria-label="Close dialog">
              ×
            </button>
            <div className="mt-4 flex flex-col gap-6">
              <div className="grid gap-4 lg:grid-cols-3">
                <label htmlFor="dimension-code" className="flex flex-col gap-2">
                  <span className="text-xs font-semibold uppercase tracking-[0.35em] text-slate-400">Code</span>
                  <input
                    id="dimension-code"
                    type="text"
                    value={draft.code}
                    onChange={(event) => setDraft((prev) => ({ ...prev, code: event.target.value }))}
                    placeholder="e.g. region"
                    disabled={Boolean(editing)}
                  />
                  <span className="text-xs text-slate-500">
                    Immutable identifier used by canonical values and mappings.
                  </span>
                </label>
                <label htmlFor="dimension-label" className="flex flex-col gap-2 lg:col-span-2">
                  <span className="text-xs font-semibold uppercase tracking-[0.35em] text-slate-400">Label</span>
                  <input
                    id="dimension-label"
                    type="text"
                    value={draft.label}
                    onChange={(event) => setDraft((prev) => ({ ...prev, label: event.target.value }))}
                    placeholder="Human-friendly dimension name"
                  />
                </label>
              </div>
              <label htmlFor="dimension-description" className="flex flex-col gap-2">
                <span className="text-xs font-semibold uppercase tracking-[0.35em] text-slate-400">Description</span>
                <textarea
                  id="dimension-description"
                  rows={3}
                  value={draft.description ?? ''}
                  onChange={(event) => setDraft((prev) => ({ ...prev, description: event.target.value }))}
                  placeholder="Optional description for reviewers"
                />
              </label>

              <div className="space-y-4">
                <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <h4 className="text-sm font-semibold uppercase tracking-[0.3em] text-slate-400">
                      Additional attributes
                    </h4>
                    <p className="text-xs text-slate-500">
                      Define custom fields captured for canonical values in this dimension.
                    </p>
                  </div>
                  <button type="button" className="button-secondary" onClick={addExtraField}>
                    Add attribute
                  </button>
                </div>

                {draftFields.length === 0 && (
                  <p className="empty-state">No attributes defined. Canonical values will only collect label and description.</p>
                )}

                <div className="flex flex-col gap-4">
                  {draftFields.map((field) => (
                    <div key={field.id} className="surface-card surface-card--accent flex flex-col gap-4">
                      <div className="grid gap-4 lg:grid-cols-4">
                        <label htmlFor={`field-key-${field.id}`} className="flex flex-col gap-2">
                          <span className="text-xs font-semibold uppercase tracking-[0.35em] text-slate-400">Key</span>
                          <input
                            id={`field-key-${field.id}`}
                            type="text"
                            value={field.key}
                            onChange={(event) => handleFieldChange(field.id, 'key', event.target.value)}
                            placeholder="e.g. iso_code"
                          />
                        </label>
                        <label htmlFor={`field-label-${field.id}`} className="flex flex-col gap-2">
                          <span className="text-xs font-semibold uppercase tracking-[0.35em] text-slate-400">Label</span>
                          <input
                            id={`field-label-${field.id}`}
                            type="text"
                            value={field.label}
                            onChange={(event) => handleFieldChange(field.id, 'label', event.target.value)}
                            placeholder="Display name"
                          />
                        </label>
                        <label htmlFor={`field-type-${field.id}`} className="flex flex-col gap-2">
                          <span className="text-xs font-semibold uppercase tracking-[0.35em] text-slate-400">Type</span>
                          <select
                            id={`field-type-${field.id}`}
                            value={field.data_type}
                            onChange={(event) =>
                              handleFieldChange(field.id, 'data_type', event.target.value as DimensionExtraFieldType)
                            }
                          >
                            <option value="string">Text</option>
                            <option value="number">Number</option>
                            <option value="boolean">Yes/No</option>
                          </select>
                        </label>
                        <div className="flex items-end justify-end">
                          <button
                            type="button"
                            className="button-danger text-xs"
                            onClick={() => removeExtraField(field.id)}
                            aria-label={`Remove attribute ${field.label || field.key || field.id}`}
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                      <div className="grid gap-4 lg:grid-cols-4">
                        <label htmlFor={`field-description-${field.id}`} className="flex flex-col gap-2 lg:col-span-3">
                          <span className="text-xs font-semibold uppercase tracking-[0.35em] text-slate-400">Description</span>
                          <input
                            id={`field-description-${field.id}`}
                            type="text"
                            value={field.description ?? ''}
                            onChange={(event) => handleFieldChange(field.id, 'description', event.target.value)}
                            placeholder="Optional guidance for reviewers"
                          />
                        </label>
                        <label className="flex items-center gap-3 text-sm text-slate-300">
                          <input
                            type="checkbox"
                            checked={field.required}
                            onChange={(event) => handleFieldChange(field.id, 'required', event.target.checked)}
                          />
                          Required
                        </label>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="modal-actions">
              <button type="button" className="button-secondary" onClick={resetEditor}>
                Cancel
              </button>
              <button type="button" className="button-primary" onClick={() => void handleSave()} disabled={isSubmitting}>
                {isSubmitting ? (
                  <span className="flex items-center gap-2">
                    <span
                      className="h-4 w-4 animate-spin rounded-full border-2 border-aurora/40 border-t-aurora"
                      aria-hidden="true"
                    />
                    Saving…
                  </span>
                ) : (
                  'Save'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteTarget && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="delete-dimension-title">
          <div className="modal-panel relative">
            <h3 id="delete-dimension-title" className="modal-title">
              Delete dimension
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
              Are you sure you want to delete the dimension <strong className="text-white">{deleteTarget.label}</strong> (
              {deleteTarget.code})? Canonical values linked to this dimension must be removed first.
            </p>
            <div className="modal-actions">
              <button type="button" className="button-secondary" onClick={() => setDeleteTarget(null)}>
                Cancel
              </button>
              <button
                type="button"
                className="button-danger"
                onClick={() => void handleDelete()}
                disabled={isSubmitting}
              >
                {isSubmitting ? (
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

export default DimensionsPage;
