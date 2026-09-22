import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';

import { fetchAllValueMappings } from '../api';
import { useAppState } from '../state/AppStateContext';
import type { CanonicalValue, DimensionExtraFieldDefinition, ToastMessage, ValueMappingExpanded } from '../types';

interface DimensionDetailPageProps {
  onToast: (toast: ToastMessage) => void;
}

interface AttributeFillRate {
  key: string;
  label: string;
  required: boolean;
  description?: string | null;
  populatedCount: number;
}

const formatDate = (value?: string | null) => {
  if (!value) return '—';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '—';
  return parsed.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
};

const DimensionDetailPage = ({ onToast }: DimensionDetailPageProps) => {
  const { canonicalValues, dimensions, isLoading } = useAppState();
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const [mappings, setMappings] = useState<ValueMappingExpanded[]>([]);
  const [loadingMappings, setLoadingMappings] = useState(true);

  const dimension = useMemo(() => dimensions.find((item) => item.code === code) ?? null, [code, dimensions]);

  const canonicalForDimension = useMemo(
    () => canonicalValues.filter((value) => value.dimension === code),
    [canonicalValues, code],
  );

  const mappingsForDimension = useMemo(
    () => mappings.filter((mapping) => mapping.ref_dimension === code),
    [code, mappings],
  );

  useEffect(() => {
    if (!code) {
      navigate('/dimensions');
      return;
    }

    const loadMappings = async () => {
      setLoadingMappings(true);
      try {
        const records = await fetchAllValueMappings();
        setMappings(records);
      } catch (error: unknown) {
        console.error(error);
        onToast({ type: 'error', content: 'Unable to load value mapping metrics.' });
      } finally {
        setLoadingMappings(false);
      }
    };

    void loadMappings();
  }, [code, navigate, onToast]);

  useEffect(() => {
    if (!isLoading && !dimension) {
      onToast({ type: 'error', content: 'Dimension not found.' });
      navigate('/dimensions');
    }
  }, [dimension, isLoading, navigate, onToast]);

  const attributeFillRates = useMemo((): AttributeFillRate[] => {
    if (!dimension) return [];
    return dimension.extra_fields.map((field) => {
      const populatedCount = canonicalForDimension.reduce((count, value) => {
        const attributeValue = value.attributes?.[field.key];
        if (attributeValue !== undefined && attributeValue !== null && `${attributeValue}`.trim() !== '') {
          return count + 1;
        }
        return count;
      }, 0);
      return {
        key: field.key,
        label: field.label,
        required: field.required,
        description: field.description,
        populatedCount,
      };
    });
  }, [canonicalForDimension, dimension]);

  const uniqueAttributeKeys = useMemo(() => {
    const keys = new Set<string>();
    dimension?.extra_fields.forEach((field) => keys.add(field.key));
    canonicalForDimension.forEach((value) => {
      Object.keys(value.attributes ?? {}).forEach((key) => keys.add(key));
    });
    return keys;
  }, [canonicalForDimension, dimension]);

  const canonicalWithDescriptions = useMemo(
    () => canonicalForDimension.filter((value) => (value.description ?? '').trim().length > 0).length,
    [canonicalForDimension],
  );

  const mappingsByStatus = useMemo(() => {
    const counts = new Map<string, number>();
    mappingsForDimension.forEach((mapping) => {
      const status = mapping.status || 'unknown';
      counts.set(status, (counts.get(status) ?? 0) + 1);
    });
    return counts;
  }, [mappingsForDimension]);

  const uniqueConnectionCount = useMemo(() => {
    const ids = new Set<number>();
    mappingsForDimension.forEach((mapping) => ids.add(mapping.source_connection_id));
    return ids.size;
  }, [mappingsForDimension]);

  const uniqueSourceFields = useMemo(() => {
    const keys = new Set<string>();
    mappingsForDimension.forEach((mapping) => {
      keys.add(`${mapping.source_connection_id}:${mapping.source_table}:${mapping.source_field}`);
    });
    return keys;
  }, [mappingsForDimension]);

  const mostRecentMapping = useMemo(() => {
    if (!mappingsForDimension.length) return null;
    return mappingsForDimension.reduce((latest, current) =>
      new Date(current.updated_at) > new Date(latest.updated_at) ? current : latest,
    );
  }, [mappingsForDimension]);

  const renderAttributes = (value: CanonicalValue, extraFields: DimensionExtraFieldDefinition[]) => {
    if (extraFields.length === 0) return <span className="text-slate-600 dark:text-slate-500">No additional attributes</span>;
    return (
      <div className="flex flex-wrap gap-2 text-xs text-[var(--color-text-primary)]">
        {extraFields.map((field) => {
          const attributeValue = value.attributes?.[field.key];
          const displayValue =
            attributeValue === null || attributeValue === undefined || `${attributeValue}`.trim() === ''
              ? '—'
              : `${attributeValue}`;
          return (
            <span key={field.key} className="badge-pill">
              <span className="text-slate-600 dark:text-slate-400">{field.label}:</span> {displayValue}
            </span>
          );
        })}
      </div>
    );
  };

  if (!dimension) {
    return null;
  }

  return (
    <div className="flex flex-col gap-8">
      <nav aria-label="Breadcrumb" className="text-sm text-slate-600 dark:text-slate-400">
        <Link to="/dimensions" className="text-indigo-600 dark:text-aurora hover:underline">
          Dimensions
        </Link>
        <span className="px-2">/</span>
        <span className="text-[var(--color-text-primary)]">{dimension.label}</span>
      </nav>

      <header className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-[0.3em] text-slate-600 dark:text-slate-400">Dimension overview</p>
          <h1 className="section-heading text-3xl text-[var(--color-text-primary)]">{dimension.label}</h1>
          <p className="text-sm text-[var(--color-text-secondary)]">{dimension.description || 'No description provided.'}</p>
          <div className="flex flex-wrap gap-2 text-xs text-slate-600 dark:text-slate-400">
            <span className="badge-pill">Code: {dimension.code}</span>
            <span className="badge-pill">Created {formatDate(dimension.created_at)}</span>
            <span className="badge-pill">Updated {formatDate(dimension.updated_at)}</span>
          </div>
        </div>
        <button type="button" className="button-secondary" onClick={() => navigate('/dimensions')}>
          Back to dimensions
        </button>
      </header>

      <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <div className="surface-card surface-card--accent border border-aurora/40">
          <p className="text-xs uppercase tracking-[0.35em] text-slate-600 dark:text-slate-400">Canonical values</p>
          <p className="mt-2 text-3xl font-semibold text-[var(--color-text-primary)]">{canonicalForDimension.length}</p>
          <p className="text-xs text-slate-600 dark:text-slate-400">Distinct canonical records curated for this dimension.</p>
        </div>
        <div className="surface-card surface-card--accent border border-sky-400/40">
          <p className="text-xs uppercase tracking-[0.35em] text-slate-600 dark:text-slate-400">Documented entries</p>
          <p className="mt-2 text-3xl font-semibold text-[var(--color-text-primary)]">{canonicalWithDescriptions}</p>
          <p className="text-xs text-slate-600 dark:text-slate-400">Canonical values with reviewer-provided descriptions.</p>
        </div>
        <div className="surface-card surface-card--accent border border-emerald-400/40">
          <p className="text-xs uppercase tracking-[0.35em] text-slate-600 dark:text-slate-400">Attribute keys</p>
          <p className="mt-2 text-3xl font-semibold text-[var(--color-text-primary)]">{uniqueAttributeKeys.size}</p>
          <p className="text-xs text-slate-600 dark:text-slate-400">Custom fields available across canonical values.</p>
        </div>
        <div className="surface-card surface-card--accent border border-indigo-400/40">
          <p className="text-xs uppercase tracking-[0.35em] text-slate-600 dark:text-slate-400">Value mappings</p>
          <p className="mt-2 text-3xl font-semibold text-[var(--color-text-primary)]">{mappingsForDimension.length}</p>
          <p className="text-xs text-slate-600 dark:text-slate-400">Approved or pending links from raw values.</p>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-3">
        <div className="surface-card lg:col-span-2">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="section-heading text-xl">Canonical coverage</h2>
              <p className="text-sm text-slate-600 dark:text-slate-400">Labels, descriptions, and attribute completeness.</p>
            </div>
            <span className="text-xs text-slate-600 dark:text-slate-500">{canonicalForDimension.length} records</span>
          </div>
          <div className="mt-4 overflow-hidden rounded-2xl border border-[var(--color-border-strong)]">
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th className="px-4 py-3 text-left">Canonical label</th>
                    <th className="px-4 py-3 text-left">Description</th>
                    <th className="px-4 py-3 text-left">Attributes</th>
                  </tr>
                </thead>
                <tbody>
                  {canonicalForDimension.length === 0 && (
                    <tr>
                      <td colSpan={3} className="px-4 py-6 text-center text-sm text-slate-600 dark:text-slate-400">
                        No canonical values captured yet.
                      </td>
                    </tr>
                  )}
                  {canonicalForDimension.map((value) => (
                    <tr key={value.id}>
                      <td className="px-4 py-3 text-[var(--color-text-primary)]">{value.canonical_label}</td>
                      <td className="px-4 py-3 text-sm text-[var(--color-text-secondary)]">{value.description || '—'}</td>
                      <td className="px-4 py-3">{renderAttributes(value, dimension.extra_fields)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="surface-card">
          <h3 className="section-heading text-lg">Attribute fill rate</h3>
          <p className="text-sm text-slate-600 dark:text-slate-400">Population of each required and optional field.</p>
          <div className="mt-4 space-y-3">
            {attributeFillRates.length === 0 && (
              <p className="text-sm text-slate-600 dark:text-slate-400">No additional attributes defined for this dimension.</p>
            )}
            {attributeFillRates.map((field) => (
              <div key={field.key} className="rounded-2xl border border-[var(--color-border-strong)] p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-[var(--color-text-primary)]">{field.label}</p>
                    <p className="text-xs text-slate-600 dark:text-slate-500">{field.description || 'No description'}</p>
                  </div>
                  <span className="badge-pill text-xs">{field.required ? 'Required' : 'Optional'}</span>
                </div>
                <p className="mt-3 text-sm text-[var(--color-text-secondary)]">
                  {field.populatedCount} of {canonicalForDimension.length || 1} canonical values populated
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="surface-card">
        <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h3 className="section-heading text-lg">Mapping health</h3>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Aggregated value mappings grouped by status and source coverage.
            </p>
          </div>
          <div className="text-right text-sm text-slate-600 dark:text-slate-400">
            {loadingMappings ? 'Loading mappings…' : `${uniqueConnectionCount} connections, ${uniqueSourceFields.size} source fields`}
            <br />
            {mostRecentMapping ? `Last update ${formatDate(mostRecentMapping.updated_at)}` : 'No mappings yet'}
          </div>
        </div>
        <div className="mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from(mappingsByStatus.entries()).map(([status, count]) => (
            <div key={status} className="rounded-2xl border border-[var(--color-border-strong)] p-4">
              <p className="text-xs uppercase tracking-[0.3em] text-slate-600 dark:text-slate-400">{status}</p>
              <p className="mt-2 text-2xl font-semibold text-[var(--color-text-primary)]">{count}</p>
              <p className="text-xs text-slate-600 dark:text-slate-500">Value mappings in this state.</p>
            </div>
          ))}
          {!mappingsByStatus.size && (
            <p className="text-sm text-slate-600 dark:text-slate-400">No mappings have been created for this dimension yet.</p>
          )}
        </div>
      </section>
    </div>
  );
};

export default DimensionDetailPage;
