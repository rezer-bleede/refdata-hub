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
} from '../components/ui';

import {
  bulkImportCanonicalValues,
  previewBulkImportCanonicalValues,
  createCanonicalValue,
  deleteCanonicalValue,
  updateCanonicalValue,
} from '../api';
import { useAppState } from '../state/AppStateContext';
import type {
  BulkImportColumnMapping,
  BulkImportPreview,
  BulkImportDuplicateRecord,
  CanonicalValue,
  CanonicalValueUpdatePayload,
  DimensionDefinition,
  DimensionExtraFieldDefinition,
  ProposedDimensionSuggestion,
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

type ColumnRole = 'ignore' | 'label' | 'dimension' | 'description' | 'attribute';

type AttributeDataType = 'string' | 'number' | 'boolean';

interface ColumnAssignment {
  role: ColumnRole;
  attributeKey?: string;
  attributeLabel?: string;
  attributeType?: AttributeDataType;
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

const humaniseDimensionCode = (code: string): string =>
  code
    .split(/[_\-\s]+/)
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(' ');

const normaliseAttributeKey = (value: string): string =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '') || value.toLowerCase();

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
  const [bulkStep, setBulkStep] = useState<'upload' | 'map'>('upload');
  const [bulkPreview, setBulkPreview] = useState<BulkImportPreview | null>(null);
  const [columnAssignments, setColumnAssignments] = useState<Record<string, ColumnAssignment>>({});
  const [selectedImportDimension, setSelectedImportDimension] = useState('');
  const [proposedDimension, setProposedDimension] = useState<ProposedDimensionSuggestion | null>(null);
  const [createImportDimension, setCreateImportDimension] = useState(false);
  const [newDimensionLabel, setNewDimensionLabel] = useState('');
  const [newDimensionDescription, setNewDimensionDescription] = useState('');
  const [availableSheets, setAvailableSheets] = useState<string[]>([]);
  const [selectedSheet, setSelectedSheet] = useState<string | null>(null);
  const [duplicateReview, setDuplicateReview] = useState<BulkImportDuplicateRecord[] | null>(null);
  const [pendingImportMapping, setPendingImportMapping] = useState<BulkImportColumnMapping | null>(null);
  const [duplicateStrategyChoice, setDuplicateStrategyChoice] = useState<'skip' | 'update'>('skip');

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
    if (!bulkPreview) {
      return;
    }

    setAvailableSheets(bulkPreview.available_sheets ?? []);
    if (bulkPreview.available_sheets.length > 0) {
      const nextSheet = bulkPreview.selected_sheet ?? bulkPreview.available_sheets[0];
      setSelectedSheet(nextSheet);
    } else {
      setSelectedSheet(null);
    }

    const initialAssignments: Record<string, ColumnAssignment> = {};
    bulkPreview.columns.forEach((column) => {
      const assignment: ColumnAssignment = {
        role: 'ignore',
        attributeLabel: column.name,
      };

      switch (column.suggested_role) {
        case 'label':
          assignment.role = 'label';
          break;
        case 'dimension':
          assignment.role = 'dimension';
          break;
        case 'description':
          assignment.role = 'description';
          break;
        case 'attribute':
          assignment.role = 'attribute';
          assignment.attributeKey = column.suggested_attribute_key ?? normaliseAttributeKey(column.name);
          assignment.attributeType = 'string';
          break;
        default:
          break;
      }

      if (assignment.role === 'attribute' && !assignment.attributeKey) {
        assignment.attributeKey = normaliseAttributeKey(column.name);
      }

      initialAssignments[column.name] = assignment;
    });

    setColumnAssignments(initialAssignments);

    const suggestedDimensionCode = bulkPreview.suggested_dimension ?? bulkDimension.trim();
    const proposed = bulkPreview.proposed_dimension ?? null;

    let dimensionCode = suggestedDimensionCode || '';
    if (!dimensionCode && proposed) {
      dimensionCode = proposed.code;
    }

    const existingDefinition = dimensionCode ? dimensionMap.get(dimensionCode) : undefined;

    if (existingDefinition) {
      setSelectedImportDimension(existingDefinition.code);
      setCreateImportDimension(false);
      setNewDimensionLabel(existingDefinition.label);
      setNewDimensionDescription(existingDefinition.description ?? '');
    } else {
      setSelectedImportDimension(dimensionCode || (proposed ? proposed.code : ''));
      const shouldCreate = Boolean((dimensionCode && !dimensionMap.has(dimensionCode)) || (!dimensionCode && proposed));
      setCreateImportDimension(shouldCreate);
      const labelGuess = proposed?.label ?? (dimensionCode ? humaniseDimensionCode(dimensionCode) : '');
      setNewDimensionLabel(labelGuess);
      setNewDimensionDescription('');
    }

    setProposedDimension(proposed);
    setBulkStep('map');
    setBulkErrors([]);
  }, [bulkPreview]);

  useEffect(() => {
    if (!selectedImportDimension) {
      return;
    }

    const definition = dimensionMap.get(selectedImportDimension);
    if (!definition) {
      return;
    }

    setColumnAssignments((previous) => {
      let mutated = false;
      const next: Record<string, ColumnAssignment> = { ...previous };

      Object.entries(previous).forEach(([columnName, assignment]) => {
        if (assignment.role !== 'attribute' || !assignment.attributeKey) {
          return;
        }

        const schema = definition.extra_fields.find((field) => field.key === assignment.attributeKey);
        if (schema) {
          const desiredType = schema.data_type as AttributeDataType;
          const desiredLabel = schema.label ?? assignment.attributeLabel;
          if (assignment.attributeType !== desiredType || assignment.attributeLabel !== desiredLabel) {
            mutated = true;
            next[columnName] = {
              ...assignment,
              attributeType: desiredType,
              attributeLabel: desiredLabel ?? assignment.attributeLabel,
            };
          }
        }
      });

      return mutated ? next : previous;
    });
  }, [dimensionMap, selectedImportDimension]);

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
    setBulkPreview(null);
    setBulkStep('upload');
    setColumnAssignments({});
    setSelectedImportDimension('');
    setProposedDimension(null);
    setCreateImportDimension(false);
    setNewDimensionLabel('');
    setNewDimensionDescription('');
    setAvailableSheets([]);
    setSelectedSheet(null);
    setDuplicateReview(null);
    setPendingImportMapping(null);
    setDuplicateStrategyChoice('skip');
  };

  const buildBulkFormData = (sheetOverride?: string | null) => {
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
    const sheetName = sheetOverride ?? selectedSheet;
    if (sheetName) {
      formData.append('sheet', sheetName);
    }
    return formData;
  };

  const handleBulkPreview = async () => {
    if (!bulkFile && !bulkText.trim()) {
      onToast({ type: 'error', content: 'Select a file or paste rows to import.' });
      return;
    }

    setIsSubmitting(true);
    try {
      const preview = await previewBulkImportCanonicalValues(buildBulkFormData(selectedSheet));
      setBulkPreview(preview);
      setDuplicateReview(null);
      setPendingImportMapping(null);
    } catch (error: unknown) {
      console.error(error);
      onToast({
        type: 'error',
        content: error instanceof Error ? error.message : 'Unable to analyse the uploaded table.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSheetSelection = async (sheetName: string) => {
    if (!sheetName) {
      return;
    }

    setSelectedSheet(sheetName);
    setIsSubmitting(true);
    try {
      const preview = await previewBulkImportCanonicalValues(buildBulkFormData(sheetName));
      setBulkPreview(preview);
      setDuplicateReview(null);
      setPendingImportMapping(null);
    } catch (error: unknown) {
      console.error(error);
      onToast({
        type: 'error',
        content: error instanceof Error ? error.message : 'Unable to analyse the selected sheet.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const updateColumnRole = (columnName: string, role: ColumnRole) => {
    setColumnAssignments((previous) => {
      const current = previous[columnName] ?? { role: 'ignore', attributeLabel: columnName };
      const assignment: ColumnAssignment = { ...current, role };

      if (role !== 'attribute') {
        assignment.attributeKey = undefined;
        assignment.attributeType = undefined;
        assignment.attributeLabel = current.attributeLabel;
      } else {
        assignment.attributeKey = current.attributeKey ?? normaliseAttributeKey(columnName);
        assignment.attributeLabel = current.attributeLabel ?? columnName;
        assignment.attributeType = current.attributeType ?? 'string';
      }

      const next: Record<string, ColumnAssignment> = { ...previous, [columnName]: assignment };
      if (role === 'label') {
        Object.entries(next).forEach(([key, value]) => {
          if (key !== columnName && value.role === 'label') {
            next[key] = { ...value, role: 'ignore' };
          }
        });
      }
      if (role === 'dimension') {
        Object.entries(next).forEach(([key, value]) => {
          if (key !== columnName && value.role === 'dimension') {
            next[key] = { ...value, role: 'ignore' };
          }
        });
      }
      if (role === 'description') {
        Object.entries(next).forEach(([key, value]) => {
          if (key !== columnName && value.role === 'description') {
            next[key] = { ...value, role: 'ignore' };
          }
        });
      }
      return next;
    });
  };

  const updateAttributeDetails = (
    columnName: string,
    updates: Partial<Pick<ColumnAssignment, 'attributeKey' | 'attributeLabel' | 'attributeType'>>,
  ) => {
    setColumnAssignments((previous) => {
      const current = previous[columnName];
      if (!current || current.role !== 'attribute') {
        return previous;
      }
      return { ...previous, [columnName]: { ...current, ...updates } };
    });
  };

  const handleImportDimensionChange = (value: string) => {
    const trimmed = value.trim();
    setSelectedImportDimension(trimmed);

    if (!trimmed) {
      setCreateImportDimension(false);
      setNewDimensionLabel('');
      setNewDimensionDescription('');
      return;
    }

    const existing = dimensionMap.get(trimmed);
    if (existing) {
      setCreateImportDimension(false);
      setNewDimensionLabel(existing.label);
      setNewDimensionDescription(existing.description ?? '');
      return;
    }

    setCreateImportDimension(true);
    const proposed = proposedDimension && proposedDimension.code === trimmed ? proposedDimension : null;
    const labelGuess = proposed?.label ?? humaniseDimensionCode(trimmed);
    setNewDimensionLabel((prev) => (prev ? prev : labelGuess));
  };

  const performBulkImport = async (mapping: BulkImportColumnMapping, strategy?: 'skip' | 'update') => {
    const submission = buildBulkFormData(selectedSheet);
    submission.append('mapping', JSON.stringify(mapping));
    if (strategy) {
      submission.append('duplicate_strategy', strategy);
    }

    const result = await bulkImportCanonicalValues(submission);

    updateCanonicalValues((previous) => {
      if (result.created.length === 0 && result.updated.length === 0) {
        return previous;
      }
      const next = new Map(previous.map((value) => [value.id, value] as const));
      result.created.forEach((value) => next.set(value.id, value));
      result.updated.forEach((value) => next.set(value.id, value));
      return Array.from(next.values());
    });

    setBulkErrors(result.errors);

    const createdCount = result.created.length;
    const updatedCount = result.updated.length;
    if (result.errors.length) {
      const summaryParts: string[] = [];
      if (createdCount) {
        summaryParts.push(`${createdCount} created`);
      }
      if (updatedCount) {
        summaryParts.push(`${updatedCount} updated`);
      }
      const summary = summaryParts.length ? summaryParts.join(', ') : 'No rows';
      onToast({
        type: 'error',
        content: `Imported ${summary} with ${result.errors.length} error(s).`,
      });
      return;
    }

    const successParts: string[] = [];
    if (createdCount) {
      successParts.push(`${createdCount} new value${createdCount === 1 ? '' : 's'}`);
    }
    if (updatedCount) {
      successParts.push(`${updatedCount} updated value${updatedCount === 1 ? '' : 's'}`);
    }
    const successMessage = successParts.length
      ? `Imported ${successParts.join(' and ')}.`
      : 'Import completed with no changes.';
    onToast({ type: 'success', content: successMessage });
    closeBulkModal();
  };

  const handleBulkImport = async () => {
    if (!bulkPreview) {
      await handleBulkPreview();
      return;
    }

    const assignments = Object.entries(columnAssignments);
    const labelColumn = assignments.find(([, assignment]) => assignment.role === 'label')?.[0];
    if (!labelColumn) {
      setBulkErrors(['Select which column represents the canonical label.']);
      return;
    }

    const dimensionColumn = assignments.find(([, assignment]) => assignment.role === 'dimension')?.[0];
    const descriptionColumn = assignments.find(([, assignment]) => assignment.role === 'description')?.[0];
    const attributeAssignments = assignments.filter(([, assignment]) => assignment.role === 'attribute');
    const missingAttributeKeys = attributeAssignments
      .filter(([, assignment]) => !assignment.attributeKey?.trim())
      .map(([column]) => column);
    if (missingAttributeKeys.length) {
      setBulkErrors([
        `Provide attribute keys for: ${missingAttributeKeys.map((column) => `“${column}”`).join(', ')}.`,
      ]);
      return;
    }

    const dimensionCode = selectedImportDimension.trim();
    if (!dimensionColumn && !dimensionCode) {
      setBulkErrors(['Select a default dimension or map a column that contains the dimension.']);
      return;
    }

    const mapping: BulkImportColumnMapping = {
      label: labelColumn,
      attributes: {},
    };

    if (dimensionColumn) {
      mapping.dimension = dimensionColumn;
    }
    if (descriptionColumn) {
      mapping.description = descriptionColumn;
    }
    if (dimensionCode) {
      mapping.default_dimension = dimensionCode;
    }

    attributeAssignments.forEach(([columnName, assignment]) => {
      if (!assignment.attributeKey) {
        return;
      }
      mapping.attributes[assignment.attributeKey] = columnName;
    });

    const dimensionExists = dimensionCode ? dimensionMap.has(dimensionCode) : false;
    if (!dimensionExists && createImportDimension && dimensionCode) {
      const extraFields: DimensionExtraFieldDefinition[] = [];
      const seenKeys = new Set<string>();
      attributeAssignments.forEach(([, assignment]) => {
        const key = assignment.attributeKey?.trim();
        if (!key || seenKeys.has(key)) {
          return;
        }
        seenKeys.add(key);
        extraFields.push({
          key,
          label: assignment.attributeLabel?.trim() || humaniseDimensionCode(key),
          data_type: assignment.attributeType ?? 'string',
          required: false,
        });
      });

      mapping.dimension_definition = {
        code: dimensionCode,
        label: newDimensionLabel.trim() || humaniseDimensionCode(dimensionCode),
        description: newDimensionDescription.trim() || undefined,
        extra_fields: extraFields,
      };
    }

    const dryRunFormData = buildBulkFormData(selectedSheet);
    dryRunFormData.append('mapping', JSON.stringify(mapping));
    dryRunFormData.append('dry_run', 'true');

    setIsSubmitting(true);
    try {
      const previewResult = await bulkImportCanonicalValues(dryRunFormData);
      setBulkErrors(previewResult.errors);

      if (previewResult.duplicates.length > 0) {
        setDuplicateReview(previewResult.duplicates);
        setPendingImportMapping(mapping);
        setDuplicateStrategyChoice('skip');
        return;
      }

      await performBulkImport(mapping);
    } catch (error: unknown) {
      console.error(error);
      onToast({
        type: 'error',
        content: error instanceof Error ? error.message : 'Bulk import failed. Try again with a different file.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const cancelDuplicateReview = () => {
    setDuplicateReview(null);
    setPendingImportMapping(null);
    setDuplicateStrategyChoice('skip');
  };

  const applyDuplicateStrategy = async () => {
    if (!pendingImportMapping) {
      return;
    }

    setIsSubmitting(true);
    try {
      await performBulkImport(pendingImportMapping, duplicateStrategyChoice);
      setDuplicateReview(null);
      setPendingImportMapping(null);
    } catch (error: unknown) {
      console.error(error);
      onToast({
        type: 'error',
        content: error instanceof Error ? error.message : 'Bulk import failed. Try again with a different file.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const assignmentEntries = Object.entries(columnAssignments);
  const labelSelected = assignmentEntries.some(([, assignment]) => assignment.role === 'label');
  const dimensionColumnSelected = assignmentEntries.some(([, assignment]) => assignment.role === 'dimension');
  const attributeKeyMissing = assignmentEntries
    .filter(([, assignment]) => assignment.role === 'attribute')
    .some(([, assignment]) => !assignment.attributeKey?.trim());

  return (
    <div className="flex flex-col gap-4" aria-label="Canonical library">
      <Card className="card-section">
        <Card.Body className="flex flex-col gap-4">
          <div className="flex flex-col lg:flex-row justify-between lg:items-center gap-3">
            <div>
              <Card.Title as="h1" className="text-2xl mb-1">
                Canonical library
              </Card.Title>
              <Card.Text className="text-slate-400 mb-0">
                Curate golden records across every dimension. Use filters to focus on a single taxonomy, manage
                dimension-specific attributes, or search by keyword.
              </Card.Text>
            </div>
            <div className="flex flex-wrap gap-2">
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

          <Row className="gap-3">
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

          <div className="overflow-x-auto">
            <Table striped hover className="align-middle whitespace-nowrap">
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
                    <td colSpan={5} className="text-center text-slate-400 py-4">
                      No canonical values match the current filters.
                    </td>
                  </tr>
                )}
                {filteredValues.map((value) => {
                  const dimension = dimensionMap.get(value.dimension);
                  const attributeEntries = dimension?.extra_fields ?? [];
                  return (
                    <tr key={value.id}>
                      <td className="font-semibold">{value.canonical_label}</td>
                      <td>
                        <Badge bg="info" className="bg-aurora/20 text-aurora">
                          {dimension ? `${dimension.label} (${dimension.code})` : value.dimension}
                        </Badge>
                      </td>
                      <td>{value.description || '—'}</td>
                      <td>
                        {attributeEntries.length === 0 ? (
                          '—'
                        ) : (
                          <div className="flex flex-col gap-1">
                            {attributeEntries.map((field) => (
                              <div key={field.key} className="text-xs text-slate-400">
                                <strong>{field.label}:</strong> {formatAttributeValue(value.attributes?.[field.key])}
                              </div>
                            ))}
                          </div>
                        )}
                      </td>
                      <td className="text-end">
                        <div className="inline-flex gap-2">
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
          <Form className="flex flex-col gap-3">
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
              <div className="flex flex-col gap-3">
                <div>
                  <h2 className="text-sm font-semibold uppercase tracking-[0.3em] text-slate-400 mb-1">
                    Dimension attributes
                  </h2>
                  <p className="text-slate-400 mb-0">
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
                      <Form.Text className="text-slate-400">{field.description}</Form.Text>
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

      <Modal show={showBulkModal} onHide={closeBulkModal} size="lg" centered>
        <Modal.Header closeButton>
          <Modal.Title>Bulk import canonical values</Modal.Title>
        </Modal.Header>
        <Modal.Body className="flex flex-col gap-3">
          {bulkStep === 'upload' && (
            <>
              <p className="mb-0 text-slate-400">
                Upload a CSV or Excel file, or paste tabular rows. After analysing the headers you can map each column to the
                canonical fields used by Reviewer.
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
                <Form.Text className="text-slate-400">
                  Provide CSV, TSV, or Excel documents. When both a file and pasted rows are supplied, the file takes
                  precedence.
                </Form.Text>
              </Form.Group>
              <Form.Group controlId="bulk-dimension">
                <Form.Label>Preferred dimension (optional)</Form.Label>
                <Form.Control
                  type="text"
                  placeholder="Hint used when rows omit a dimension column"
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
                  <h2 className="text-sm font-semibold uppercase tracking-[0.3em] text-slate-400">Import issues</h2>
                  <ul className="mb-0">
                    {bulkErrors.map((error, index) => (
                      <li key={`${error}-${index}`}>{error}</li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}
          {bulkStep === 'map' && bulkPreview && (
            <>
              <p className="mb-0 text-slate-400">
                Confirm how the uploaded columns should map to canonical fields. Assign at least one column to the canonical
                label and select the target dimension.
              </p>
              {availableSheets.length > 1 && (
                <Form.Group controlId="bulk-sheet-selection">
                  <Form.Label>Workbook sheet</Form.Label>
                  <Form.Select
                    value={selectedSheet ?? (availableSheets[0] ?? '')}
                    onChange={(event) => void handleSheetSelection(event.target.value)}
                    disabled={isSubmitting}
                  >
                    {availableSheets.map((sheetName) => (
                      <option key={sheetName} value={sheetName}>
                        {sheetName}
                      </option>
                    ))}
                  </Form.Select>
                  <Form.Text className="text-slate-400">
                    Choose which sheet to analyse. Imports process one sheet at a time.
                  </Form.Text>
                </Form.Group>
              )}
              <Form.Group controlId="bulk-dimension-selection">
                <Form.Label>Target dimension</Form.Label>
                <Form.Control
                  type="text"
                  value={selectedImportDimension}
                  placeholder="e.g. region"
                  list="existing-dimensions"
                  onChange={(event) => handleImportDimensionChange(event.target.value)}
                />
                <datalist id="existing-dimensions">
                  {dimensions.map((dimension) => (
                    <option key={dimension.code} value={dimension.code}>
                      {dimension.label}
                    </option>
                  ))}
                </datalist>
                <Form.Text className="text-slate-400">
                  Choose an existing dimension or enter a new code to create one during import.
                </Form.Text>
              </Form.Group>
              {createImportDimension && selectedImportDimension && !dimensionMap.has(selectedImportDimension) && (
                <Row className="gap-3">
                  <Col md={6}>
                    <Form.Group controlId="bulk-new-dimension-label">
                      <Form.Label>New dimension label</Form.Label>
                      <Form.Control
                        type="text"
                        value={newDimensionLabel}
                        onChange={(event) => setNewDimensionLabel(event.target.value)}
                      />
                    </Form.Group>
                  </Col>
                  <Col md={6}>
                    <Form.Group controlId="bulk-new-dimension-description">
                      <Form.Label>Description (optional)</Form.Label>
                      <Form.Control
                        type="text"
                        value={newDimensionDescription}
                        onChange={(event) => setNewDimensionDescription(event.target.value)}
                      />
                    </Form.Group>
                  </Col>
                </Row>
              )}
              <div className="overflow-x-auto">
                <Table bordered size="sm" className="align-middle">
                  <thead>
                    <tr>
                      <th className="w-1/4">Column</th>
                      <th className="w-1/4">Sample</th>
                      <th className="w-1/4">Role</th>
                      <th>Details</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bulkPreview.columns.map((column) => {
                      const assignment = columnAssignments[column.name] ?? {
                        role: 'ignore' as ColumnRole,
                        attributeLabel: column.name,
                      };
                      const attributeSchema =
                        assignment.role === 'attribute' && assignment.attributeKey
                          ? dimensionMap.get(selectedImportDimension ?? '')?.extra_fields.find(
                              (field) => field.key === assignment.attributeKey,
                            )
                          : undefined;
                      return (
                        <tr key={column.name}>
                          <td>
                            <strong>{column.name}</strong>
                          </td>
                          <td>
                            {column.sample.length === 0
                              ? '—'
                              : column.sample
                                  .slice(0, 3)
                                  .map((value) => `“${value}”`)
                                  .join(', ')}
                            {column.sample.length > 3 && '…'}
                          </td>
                          <td>
                            <Form.Select
                              aria-label={`Mapping for ${column.name}`}
                              value={assignment.role}
                              onChange={(event) => updateColumnRole(column.name, event.target.value as ColumnRole)}
                            >
                              <option value="ignore">Ignore column</option>
                              <option value="label">Canonical label</option>
                              <option value="dimension">Dimension code</option>
                              <option value="description">Description</option>
                              <option value="attribute">Attribute</option>
                            </Form.Select>
                          </td>
                          <td>
                            {assignment.role === 'attribute' ? (
                              <div className="flex flex-col gap-2">
                                <Form.Group controlId={`attribute-key-${column.name}`}>
                                  <Form.Label className="mb-1">Attribute key</Form.Label>
                                  <Form.Control
                                    type="text"
                                    value={assignment.attributeKey ?? ''}
                                    placeholder="e.g. numeric_code"
                                    onChange={(event) =>
                                      updateAttributeDetails(column.name, {
                                        attributeKey: event.target.value,
                                      })
                                    }
                                  />
                                  <Form.Text className="text-slate-400">
                                    Keys should match the dimension schema. New dimensions will create attributes using these keys.
                                  </Form.Text>
                                </Form.Group>
                                {createImportDimension && selectedImportDimension && !dimensionMap.has(selectedImportDimension) ? (
                                  <Row className="gap-2">
                                    <Col md={6}>
                                      <Form.Group controlId={`attribute-label-${column.name}`}>
                                        <Form.Label className="mb-1">Display label</Form.Label>
                                        <Form.Control
                                          type="text"
                                          value={assignment.attributeLabel ?? column.name}
                                          onChange={(event) =>
                                            updateAttributeDetails(column.name, {
                                              attributeLabel: event.target.value,
                                            })
                                          }
                                        />
                                      </Form.Group>
                                    </Col>
                                    <Col md={6}>
                                      <Form.Group controlId={`attribute-type-${column.name}`}>
                                        <Form.Label className="mb-1">Data type</Form.Label>
                                        <Form.Select
                                          value={assignment.attributeType ?? 'string'}
                                          onChange={(event) =>
                                            updateAttributeDetails(column.name, {
                                              attributeType: event.target.value as AttributeDataType,
                                            })
                                          }
                                        >
                                          <option value="string">Text</option>
                                          <option value="number">Number</option>
                                          <option value="boolean">True / False</option>
                                        </Form.Select>
                                      </Form.Group>
                                    </Col>
                                  </Row>
                                ) : attributeSchema ? (
                                  <div className="text-slate-400 text-xs">
                                    Maps to <strong>{attributeSchema.label}</strong> ({attributeSchema.key})
                                  </div>
                                ) : null}
                              </div>
                            ) : (
                              <span className="text-slate-400">{column.suggested_role ? `Suggested: ${column.suggested_role}` : '—'}</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </Table>
              </div>
              {bulkErrors.length > 0 && (
                <div className="alert alert-warning mb-0" role="alert">
                  <h2 className="text-sm font-semibold uppercase tracking-[0.3em] text-slate-400">Import issues</h2>
                  <ul className="mb-0">
                    {bulkErrors.map((error, index) => (
                      <li key={`${error}-${index}`}>{error}</li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="outline-secondary" onClick={closeBulkModal} disabled={isSubmitting}>
            Cancel
          </Button>
          {bulkStep === 'map' ? (
            <>
              <Button
                variant="outline-secondary"
                onClick={() => {
                  setBulkPreview(null);
                  setBulkStep('upload');
                  setBulkErrors([]);
                }}
                disabled={isSubmitting}
              >
                Back
              </Button>
              <Button
                variant="primary"
                onClick={() => void handleBulkImport()}
                disabled={
                  isSubmitting ||
                  !labelSelected ||
                  (!dimensionColumnSelected && !selectedImportDimension.trim()) ||
                  attributeKeyMissing
                }
              >
                {isSubmitting ? (
                  <span className="inline-flex items-center gap-2">
                    <Spinner animation="border" size="sm" role="status" aria-hidden="true" />
                    Importing…
                  </span>
                ) : (
                  'Import rows'
                )}
              </Button>
            </>
          ) : (
            <Button variant="primary" onClick={() => void handleBulkPreview()} disabled={isSubmitting}>
              {isSubmitting ? (
                <span className="inline-flex items-center gap-2">
                  <Spinner animation="border" size="sm" role="status" aria-hidden="true" />
                  Analysing…
                </span>
              ) : (
                'Review mappings'
              )}
            </Button>
          )}
        </Modal.Footer>
      </Modal>

      <Modal show={duplicateReview !== null} onHide={cancelDuplicateReview} centered>
        <Modal.Header closeButton>
          <Modal.Title>Resolve duplicate canonical values</Modal.Title>
        </Modal.Header>
        <Modal.Body className="flex flex-col gap-3">
          <p className="mb-0 text-slate-400">
            {duplicateReview ? `${duplicateReview.length} record${duplicateReview.length === 1 ? '' : 's'}` : 'Records'}
            {' '}already exist in the selected dimension. Choose how the importer should handle them before continuing.
          </p>
          <div className="flex flex-col gap-2">
            <Form.Check
              type="radio"
              id="duplicate-strategy-skip"
              name="duplicate-strategy"
              label="Skip duplicates and keep the existing canonical values."
              value="skip"
              checked={duplicateStrategyChoice === 'skip'}
              onChange={() => setDuplicateStrategyChoice('skip')}
              disabled={isSubmitting}
            />
            <Form.Check
              type="radio"
              id="duplicate-strategy-update"
              name="duplicate-strategy"
              label="Update existing canonical values with the data from this import."
              value="update"
              checked={duplicateStrategyChoice === 'update'}
              onChange={() => setDuplicateStrategyChoice('update')}
              disabled={isSubmitting}
            />
          </div>
          {duplicateReview && duplicateReview.length > 0 && (
            <div className="overflow-x-auto">
              <Table bordered size="sm" className="align-middle">
                <thead>
                  <tr>
                    <th>Row</th>
                    <th>Dimension</th>
                    <th>Label</th>
                    <th>Existing description</th>
                    <th>Incoming description</th>
                    <th>Existing attributes</th>
                    <th>Incoming attributes</th>
                  </tr>
                </thead>
                <tbody>
                  {duplicateReview.map((duplicate) => {
                    const existingAttributes = Object.entries(duplicate.existing_value.attributes ?? {});
                    const incomingAttributes = Object.entries(duplicate.incoming_attributes ?? {});
                    return (
                      <tr key={`${duplicate.dimension}-${duplicate.canonical_label}-${duplicate.row_number}`}>
                        <td>{duplicate.row_number}</td>
                        <td>{duplicate.dimension}</td>
                        <td>{duplicate.canonical_label}</td>
                        <td>{duplicate.existing_value.description ?? '—'}</td>
                        <td>{duplicate.incoming_description ?? '—'}</td>
                        <td>
                          {existingAttributes.length === 0 ? (
                            '—'
                          ) : (
                            <div className="flex flex-col gap-1">
                              {existingAttributes.map(([key, value]) => (
                                <span key={key} className="text-xs text-slate-400">
                                  <strong>{key}:</strong> {formatAttributeValue(value)}
                                </span>
                              ))}
                            </div>
                          )}
                        </td>
                        <td>
                          {incomingAttributes.length === 0 ? (
                            '—'
                          ) : (
                            <div className="flex flex-col gap-1">
                              {incomingAttributes.map(([key, value]) => (
                                <span key={key} className="text-xs text-slate-400">
                                  <strong>{key}:</strong> {formatAttributeValue(value)}
                                </span>
                              ))}
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </Table>
            </div>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="outline-secondary" onClick={cancelDuplicateReview} disabled={isSubmitting}>
            Back
          </Button>
          <Button
            variant="primary"
            onClick={() => void applyDuplicateStrategy()}
            disabled={isSubmitting || !duplicateReview?.length}
          >
            {isSubmitting ? (
              <span className="inline-flex items-center gap-2">
                <Spinner animation="border" size="sm" role="status" aria-hidden="true" />
                Resolving…
              </span>
            ) : (
              'Apply and continue'
            )}
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default CanonicalLibraryPage;
