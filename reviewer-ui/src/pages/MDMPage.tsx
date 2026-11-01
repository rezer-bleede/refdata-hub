import { useCallback, useEffect, useMemo, useState } from 'react';

import {
  approveMDMSourceRecord,
  createMasterEntity,
  createMasterRecord,
  createMasterRecordLink,
  deleteMasterEntity,
  deleteMasterRecordLink,
  fetchEntityQuality,
  fetchMasterEntities,
  fetchMasterRecordHistory,
  fetchMasterRecordLinks,
  fetchMasterRecords,
  fetchMDMSourceRecords,
  fetchSourceConnections,
  ingestMDMSourceRecords,
  mergeMasterRecord,
  rejectMDMSourceRecord,
  runMDMAgent,
  suggestMDMMatches,
  unmergeMasterRecord,
  updateMasterEntity,
  updateMasterRecord,
} from '../api';
import type {
  EntityQualityReport,
  MasterEntity,
  MasterEntityPayload,
  MasterRecord,
  MasterRecordLink,
  MDMCandidate,
  MDMAgentResult,
  MergeHistoryEntry,
  SourceConnection,
  SourceRecord,
  ToastMessage,
} from '../types';

interface MDMPageProps {
  onToast: (toast: ToastMessage) => void;
}

type Tab = 'entities' | 'records' | 'stewardship' | 'quality';

const tabs: Array<{ id: Tab; label: string }> = [
  { id: 'entities', label: 'Entity types' },
  { id: 'records', label: 'Golden records' },
  { id: 'stewardship', label: 'Stewardship' },
  { id: 'quality', label: 'Quality & hierarchy' },
];

const pretty = (value: unknown) => JSON.stringify(value, null, 2);
const labelFor = (record: MasterRecord) => String(record.attributes.name ?? record.attributes.label ?? `Record #${record.id}`);
const errorText = (error: unknown) => error instanceof Error ? error.message : 'Request failed';

const MDMPage = ({ onToast }: MDMPageProps) => {
  const [tab, setTab] = useState<Tab>('records');
  const [entities, setEntities] = useState<MasterEntity[]>([]);
  const [entityCode, setEntityCode] = useState('');
  const [records, setRecords] = useState<MasterRecord[]>([]);
  const [sourceRecords, setSourceRecords] = useState<SourceRecord[]>([]);
  const [connections, setConnections] = useState<SourceConnection[]>([]);
  const [links, setLinks] = useState<MasterRecordLink[]>([]);
  const [quality, setQuality] = useState<EntityQualityReport | null>(null);
  const [loading, setLoading] = useState(false);

  const [editingEntity, setEditingEntity] = useState<MasterEntity | null>(null);
  const [entityEditorOpen, setEntityEditorOpen] = useState(false);
  const [entityCodeDraft, setEntityCodeDraft] = useState('');
  const [entityLabelDraft, setEntityLabelDraft] = useState('');
  const [entityDescriptionDraft, setEntityDescriptionDraft] = useState('');
  const [entityConfigDraft, setEntityConfigDraft] = useState(pretty({
    attribute_schema: [], match_fields: [], match_threshold: 0.95,
    survivorship_rules: {}, quality_rules: [],
  }));

  const [selectedRecord, setSelectedRecord] = useState('');
  const [recordAttributes, setRecordAttributes] = useState('{}');
  const [connectionId, setConnectionId] = useState('');
  const [sourceTable, setSourceTable] = useState('');
  const [sourceInput, setSourceInput] = useState('[\n  { "source_pk": "1", "payload": {} }\n]');
  const [suggestions, setSuggestions] = useState<Record<number, MDMCandidate[]>>({});
  const [agentResults, setAgentResults] = useState<Record<number, MDMAgentResult>>({});
  const [mergeTargets, setMergeTargets] = useState<Record<number, string>>({});
  const [history, setHistory] = useState<MergeHistoryEntry[]>([]);
  const [historyRecord, setHistoryRecord] = useState<number | null>(null);
  const [parentId, setParentId] = useState('');
  const [childId, setChildId] = useState('');
  const [relationType, setRelationType] = useState('parent_of');

  const activeEntity = useMemo(
    () => entities.find((entity) => entity.code === entityCode) ?? null,
    [entities, entityCode],
  );
  const activeRecords = useMemo(() => records.filter((record) => record.status === 'active'), [records]);

  const loadWorkspace = useCallback(async (code: string) => {
    if (!code) return;
    setLoading(true);
    try {
      const [nextRecords, nextSources, nextLinks, nextQuality] = await Promise.all([
        fetchMasterRecords(code, true), fetchMDMSourceRecords(code), fetchMasterRecordLinks(code), fetchEntityQuality(code),
      ]);
      setRecords(nextRecords);
      setSourceRecords(nextSources);
      setLinks(nextLinks);
      setQuality(nextQuality);
    } catch (error) {
      onToast({ type: 'error', content: errorText(error) });
    } finally {
      setLoading(false);
    }
  }, [onToast]);

  const loadEntities = useCallback(async () => {
    try {
      const [nextEntities, nextConnections] = await Promise.all([fetchMasterEntities(), fetchSourceConnections()]);
      setEntities(nextEntities);
      setConnections(nextConnections);
      setEntityCode((current) => current || nextEntities[0]?.code || '');
      setConnectionId((current) => current || String(nextConnections[0]?.id ?? ''));
    } catch (error) {
      onToast({ type: 'error', content: errorText(error) });
    }
  }, [onToast]);

  useEffect(() => { void loadEntities(); }, [loadEntities]);
  useEffect(() => { void loadWorkspace(entityCode); }, [entityCode, loadWorkspace]);

  const reload = async () => {
    await loadEntities();
    if (entityCode) await loadWorkspace(entityCode);
  };

  const beginEntityEdit = (entity?: MasterEntity) => {
    setEntityEditorOpen(true);
    setEditingEntity(entity ?? null);
    setEntityCodeDraft(entity?.code ?? '');
    setEntityLabelDraft(entity?.label ?? '');
    setEntityDescriptionDraft(entity?.description ?? '');
    setEntityConfigDraft(pretty(entity ? {
      attribute_schema: entity.attribute_schema,
      match_fields: entity.match_fields,
      match_threshold: entity.match_threshold,
      survivorship_rules: entity.survivorship_rules,
      quality_rules: entity.quality_rules,
    } : {
      attribute_schema: [], match_fields: [], match_threshold: 0.95,
      survivorship_rules: {}, quality_rules: [],
    }));
  };

  const saveEntity = async () => {
    try {
      const config = JSON.parse(entityConfigDraft) as Omit<MasterEntityPayload, 'code' | 'label' | 'description'>;
      const payload: MasterEntityPayload = {
        code: entityCodeDraft.trim(), label: entityLabelDraft.trim(),
        description: entityDescriptionDraft || null, ...config,
      };
      if (!payload.code || !payload.label) throw new Error('Entity code and label are required.');
      const saved = editingEntity
        ? await updateMasterEntity(editingEntity.code, {
          label: payload.label, description: payload.description,
          attribute_schema: payload.attribute_schema, match_fields: payload.match_fields,
          match_threshold: payload.match_threshold, survivorship_rules: payload.survivorship_rules,
          quality_rules: payload.quality_rules,
        })
        : await createMasterEntity(payload);
      await loadEntities();
      setEntityCode(saved.code);
      setEditingEntity(saved);
      setEntityEditorOpen(true);
      onToast({ type: 'success', content: `${saved.label} saved.` });
    } catch (error) {
      onToast({ type: 'error', content: errorText(error) });
    }
  };

  const removeEntity = async () => {
    if (!activeEntity || !window.confirm(`Delete entity type “${activeEntity.label}”?`)) return;
    try {
      await deleteMasterEntity(activeEntity.code);
      const next = entities.filter((entity) => entity.code !== activeEntity.code);
      setEntities(next);
      setEntityCode(next[0]?.code ?? '');
      onToast({ type: 'success', content: 'Entity type deleted.' });
    } catch (error) {
      onToast({ type: 'error', content: errorText(error) });
    }
  };

  const saveRecord = async () => {
    if (!entityCode) return;
    try {
      const attributes = JSON.parse(recordAttributes) as Record<string, unknown>;
      const saved = selectedRecord
        ? await updateMasterRecord(Number(selectedRecord), attributes)
        : await createMasterRecord(entityCode, attributes);
      setSelectedRecord(String(saved.id));
      await loadWorkspace(entityCode);
      onToast({ type: 'success', content: selectedRecord ? 'Golden record updated.' : 'Golden record created.' });
    } catch (error) {
      onToast({ type: 'error', content: errorText(error) });
    }
  };

  const ingest = async () => {
    try {
      const parsed: unknown = JSON.parse(sourceInput);
      if (!Array.isArray(parsed) || parsed.some((row) => !row || typeof row !== 'object' || typeof row.source_pk !== 'string' || !row.payload || typeof row.payload !== 'object')) {
        throw new Error('Provide an array of records with source_pk and payload fields.');
      }
      const result = await ingestMDMSourceRecords({
        source_connection_id: Number(connectionId), entity_code: entityCode, source_table: sourceTable,
        records: parsed as Array<{ source_pk: string; payload: Record<string, unknown>; source_priority?: number; source_updated_at?: string }>,
      });
      await loadWorkspace(entityCode);
      onToast({ type: 'success', content: `Ingested ${result.created} new and ${result.updated} updated source records.` });
    } catch (error) {
      onToast({ type: 'error', content: errorText(error) });
    }
  };

  const approve = async (source: SourceRecord, masterId?: number) => {
    try {
      await approveMDMSourceRecord(source.id, masterId);
      await loadWorkspace(entityCode);
      onToast({ type: 'success', content: 'Source record approved into the crosswalk.' });
    } catch (error) {
      onToast({ type: 'error', content: errorText(error) });
    }
  };

  const reject = async (sourceId: number) => {
    try {
      await rejectMDMSourceRecord(sourceId);
      await loadWorkspace(entityCode);
      onToast({ type: 'success', content: 'Source record rejected.' });
    } catch (error) {
      onToast({ type: 'error', content: errorText(error) });
    }
  };

  const getSuggestions = async (sourceId: number) => {
    try {
      const next = await suggestMDMMatches(sourceId);
      setSuggestions((current) => ({ ...current, [sourceId]: next }));
      await loadWorkspace(entityCode);
    } catch (error) {
      onToast({ type: 'error', content: errorText(error) });
    }
  };

  const runAgent = async (sourceId: number) => {
    try {
      const result = await runMDMAgent(sourceId);
      setAgentResults((current) => ({ ...current, [sourceId]: result }));
      await loadWorkspace(entityCode);
      onToast({ type: result.status === 'error' ? 'error' : 'success', content: result.summary ?? result.error ?? 'MDM agent run finished.' });
    } catch (error) {
      onToast({ type: 'error', content: errorText(error) });
    }
  };

  const merge = async (recordId: number) => {
    const target = Number(mergeTargets[recordId]);
    if (!target || !window.confirm(`Merge record #${recordId} into #${target}?`)) return;
    try {
      await mergeMasterRecord(recordId, target);
      await loadWorkspace(entityCode);
      onToast({ type: 'success', content: `Record #${recordId} merged into #${target}.` });
    } catch (error) {
      onToast({ type: 'error', content: errorText(error) });
    }
  };

  const unmerge = async (recordId: number) => {
    try {
      await unmergeMasterRecord(recordId);
      await loadWorkspace(entityCode);
      onToast({ type: 'success', content: `Record #${recordId} restored.` });
    } catch (error) {
      onToast({ type: 'error', content: errorText(error) });
    }
  };

  const addLink = async () => {
    try {
      await createMasterRecordLink({ parent_id: Number(parentId), child_id: Number(childId), relation_type: relationType });
      await loadWorkspace(entityCode);
      onToast({ type: 'success', content: 'Record hierarchy link created.' });
    } catch (error) {
      onToast({ type: 'error', content: errorText(error) });
    }
  };

  const toggleHistory = async (recordId: number) => {
    if (historyRecord === recordId) {
      setHistoryRecord(null);
      return;
    }
    try {
      setHistory(await fetchMasterRecordHistory(recordId));
      setHistoryRecord(recordId);
    } catch (error) {
      onToast({ type: 'error', content: errorText(error) });
    }
  };

  const panelClass = 'rounded-2xl border border-widget-border bg-widget-bg p-5';
  const inputClass = 'w-full rounded-xl border border-border-primary bg-bg-tertiary px-3 py-2 text-sm text-text-primary';
  const buttonClass = 'rounded-xl bg-brand-primary px-4 py-2 text-xs font-bold text-brand-accent-contrast disabled:opacity-50';
  const secondaryButton = 'rounded-xl border border-widget-border px-3 py-2 text-xs font-semibold text-text-secondary hover:bg-bg-hover disabled:opacity-50';

  return (
    <div className="space-y-5">
      <section className={`${panelClass} flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between`}>
        <div className="min-w-0 flex-1">
          <label className="mb-2 block text-[11px] font-bold uppercase tracking-wider text-text-tertiary" htmlFor="mdm-entity">Entity type</label>
          <select id="mdm-entity" className={`${inputClass} max-w-md`} value={entityCode} onChange={(event) => setEntityCode(event.target.value)}>
            {entities.length === 0 && <option value="">Create an entity type to start</option>}
            {entities.map((entity) => <option key={entity.code} value={entity.code}>{entity.label} · {entity.code}</option>)}
          </select>
        </div>
        <div className="flex gap-2">
          <button type="button" className={secondaryButton} onClick={() => void reload()} disabled={loading}>Refresh</button>
          <button type="button" className={buttonClass} onClick={() => { setTab('entities'); beginEntityEdit(); }}>New entity type</button>
        </div>
      </section>

      <nav className="flex flex-wrap gap-2" aria-label="MDM sections">
        {tabs.map((item) => (
          <button key={item.id} type="button" className={`${tab === item.id ? buttonClass : secondaryButton} px-4`} onClick={() => setTab(item.id)}>
            {item.label}
          </button>
        ))}
      </nav>

      {!activeEntity && tab !== 'entities' ? (
        <section className={panelClass}><p className="text-sm text-text-secondary">Create a generic entity type to begin managing master records.</p></section>
      ) : null}

      {tab === 'entities' && (
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
          <section className={`${panelClass} space-y-4`}>
            <div className="flex items-center justify-between gap-3">
              <div><h2 className="font-bold text-text-primary">Entity configuration</h2><p className="mt-1 text-xs text-text-tertiary">Define governed attributes, match keys, survivorship, and quality rules.</p></div>
              {activeEntity && <button type="button" className={secondaryButton} onClick={() => beginEntityEdit(activeEntity)}>Edit selected</button>}
            </div>
            {entityEditorOpen || !activeEntity ? (
              <>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="space-y-1 text-xs text-text-tertiary">Code<input className={inputClass} value={entityCodeDraft} disabled={Boolean(editingEntity)} onChange={(event) => setEntityCodeDraft(event.target.value)} /></label>
                  <label className="space-y-1 text-xs text-text-tertiary">Label<input className={inputClass} value={entityLabelDraft} onChange={(event) => setEntityLabelDraft(event.target.value)} /></label>
                </div>
                <label className="block space-y-1 text-xs text-text-tertiary">Description<input className={inputClass} value={entityDescriptionDraft} onChange={(event) => setEntityDescriptionDraft(event.target.value)} /></label>
                <label className="block space-y-1 text-xs text-text-tertiary">Configuration JSON<textarea className={`${inputClass} min-h-64 font-mono text-xs`} value={entityConfigDraft} onChange={(event) => setEntityConfigDraft(event.target.value)} /></label>
                <div className="flex gap-2"><button type="button" className={buttonClass} onClick={() => void saveEntity()}>Save entity type</button><button type="button" className={secondaryButton} onClick={() => { setEntityEditorOpen(false); setEditingEntity(null); }}>Cancel</button></div>
              </>
            ) : <p className="text-sm text-text-secondary">Select an entity type and choose Edit selected, or create a new one.</p>}
          </section>
          <section className={`${panelClass} space-y-4`}>
            <h2 className="font-bold text-text-primary">Configured types</h2>
            {entities.length === 0 ? <p className="text-sm text-text-tertiary">No entity types yet.</p> : entities.map((entity) => (
              <article key={entity.code} className="flex items-center justify-between gap-3 rounded-xl border border-widget-border p-3">
                <button type="button" className="min-w-0 text-left" onClick={() => { setEntityCode(entity.code); beginEntityEdit(entity); }}>
                  <span className="block truncate text-sm font-bold text-text-primary">{entity.label}</span>
                  <span className="block text-xs text-text-tertiary">{entity.code} · {entity.attribute_schema.length} attributes · {entity.match_fields.length} match fields</span>
                </button>
                {activeEntity?.code === entity.code && <button type="button" className={secondaryButton} onClick={() => void removeEntity()}>Delete</button>}
              </article>
            ))}
          </section>
        </div>
      )}

      {tab === 'records' && activeEntity && (
        <div className="grid gap-5 xl:grid-cols-[minmax(280px,0.8fr)_minmax(0,1.5fr)]">
          <section className={`${panelClass} space-y-4`}>
            <div><h2 className="font-bold text-text-primary">Golden record editor</h2><p className="mt-1 text-xs text-text-tertiary">JSON attributes are validated against the {activeEntity.code} schema.</p></div>
            <label className="block space-y-1 text-xs text-text-tertiary">Edit existing record<select className={inputClass} value={selectedRecord} onChange={(event) => {
              const value = event.target.value;
              setSelectedRecord(value);
              const record = records.find((item) => item.id === Number(value));
              setRecordAttributes(pretty(record?.attributes ?? {}));
            }}><option value="">Create new record</option>{activeRecords.map((record) => <option key={record.id} value={record.id}>#{record.id} · {labelFor(record)}</option>)}</select></label>
            <label className="block space-y-1 text-xs text-text-tertiary">Attributes JSON<textarea className={`${inputClass} min-h-64 font-mono text-xs`} value={recordAttributes} onChange={(event) => setRecordAttributes(event.target.value)} /></label>
            <button type="button" className={buttonClass} onClick={() => void saveRecord()}>{selectedRecord ? 'Save record' : 'Create golden record'}</button>
          </section>

          <section className={`${panelClass} space-y-4`}>
            <div className="flex items-center justify-between"><div><h2 className="font-bold text-text-primary">Golden records</h2><p className="mt-1 text-xs text-text-tertiary">{activeRecords.length} active · {records.length - activeRecords.length} merged</p></div><span className="text-xs text-text-tertiary">{loading ? 'Refreshing…' : `v${activeRecords.reduce((max, row) => Math.max(max, row.version), 0)} latest`}</span></div>
            {records.length === 0 ? <p className="text-sm text-text-tertiary">No golden records in this entity type yet.</p> : records.map((record) => (
              <article key={record.id} className="rounded-xl border border-widget-border p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div><p className="font-bold text-text-primary">{labelFor(record)} <span className="font-normal text-text-tertiary">#{record.id}</span></p><p className="mt-1 text-xs text-text-tertiary">{record.status} · version {record.version}{record.merged_into_id ? ` · merged into #${record.merged_into_id}` : ''}</p></div>
                  <button type="button" className={secondaryButton} onClick={() => void toggleHistory(record.id)}>Merge history</button>
                </div>
                <pre className="mt-3 max-h-40 overflow-auto rounded-lg bg-bg-tertiary p-3 text-xs text-text-secondary">{pretty(record.attributes)}</pre>
                {record.status === 'active' ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    <select aria-label={`Merge target for record ${record.id}`} className={`${inputClass} max-w-xs`} value={mergeTargets[record.id] ?? ''} onChange={(event) => setMergeTargets((current) => ({ ...current, [record.id]: event.target.value }))}>
                      <option value="">Select survivor…</option>{activeRecords.filter((target) => target.id !== record.id).map((target) => <option key={target.id} value={target.id}>#{target.id} · {labelFor(target)}</option>)}
                    </select>
                    <button type="button" className={secondaryButton} onClick={() => void merge(record.id)} disabled={!mergeTargets[record.id]}>Merge into selected</button>
                  </div>
                ) : <button type="button" className={`${secondaryButton} mt-3`} onClick={() => void unmerge(record.id)}>Unmerge</button>}
                {historyRecord === record.id && <div className="mt-3 space-y-2 border-t border-widget-border pt-3">
                  {history.length === 0 ? <p className="text-xs text-text-tertiary">No merge events.</p> : history.map((event) => <div key={event.id} className="rounded-lg bg-bg-tertiary p-3 text-xs text-text-secondary"><p>Merge #{event.merged_record_id} → #{event.survivor_id} · {new Date(event.created_at).toLocaleString()} {event.unmerged_at ? '· undone' : '· active'}</p><p className="mt-1">Rules: {Object.entries(event.survivorship_used).map(([key, rule]) => `${key}=${rule}`).join(', ') || 'none'}</p></div>)}
                </div>}
              </article>
            ))}
          </section>
        </div>
      )}

      {tab === 'stewardship' && activeEntity && (
        <div className="space-y-5">
          <section className={`${panelClass} space-y-4`}>
            <div><h2 className="font-bold text-text-primary">Crosswalk ingestion</h2><p className="mt-1 text-xs text-text-tertiary">Push source records for matching and human approval. Duplicate identities update in place.</p></div>
            <div className="grid gap-3 sm:grid-cols-3">
              <label className="space-y-1 text-xs text-text-tertiary">Source connection<select className={inputClass} value={connectionId} onChange={(event) => setConnectionId(event.target.value)}><option value="">Choose connection…</option>{connections.map((connection) => <option key={connection.id} value={connection.id}>{connection.name}</option>)}</select></label>
              <label className="space-y-1 text-xs text-text-tertiary">Source table<input className={inputClass} value={sourceTable} onChange={(event) => setSourceTable(event.target.value)} placeholder="companies" /></label>
              <div className="flex items-end"><button type="button" className={buttonClass} onClick={() => void ingest()} disabled={!connectionId || !sourceTable || !entityCode}>Ingest source records</button></div>
            </div>
            <label className="block space-y-1 text-xs text-text-tertiary">Records JSON<textarea className={`${inputClass} min-h-32 font-mono text-xs`} value={sourceInput} onChange={(event) => setSourceInput(event.target.value)} /></label>
          </section>
          <section className={`${panelClass} space-y-4`}>
            <div className="flex items-center justify-between gap-3"><div><h2 className="font-bold text-text-primary">Stewardship queue</h2><p className="mt-1 text-xs text-text-tertiary">AI and matcher output remain advisory until approved here.</p></div><span className="rounded-full bg-brand-warning/10 px-3 py-1 text-xs font-bold text-brand-warning">{sourceRecords.filter((row) => row.status !== 'approved').length} to review</span></div>
            {sourceRecords.filter((row) => row.status !== 'approved').length === 0 ? <p className="text-sm text-text-tertiary">No source records are awaiting review.</p> : sourceRecords.filter((row) => row.status !== 'approved').map((source) => (
              <article key={source.id} className="rounded-xl border border-widget-border p-4">
                <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-bold text-text-primary">{source.source_table} · {source.source_pk}</p><p className="mt-1 text-xs text-text-tertiary">{source.status} · source #{source.source_connection_id}{source.confidence !== null && source.confidence !== undefined ? ` · score ${source.confidence.toFixed(3)}` : ''}</p></div><div className="flex flex-wrap gap-2"><button type="button" className={secondaryButton} onClick={() => void getSuggestions(source.id)}>Find matches</button><button type="button" className={secondaryButton} onClick={() => void runAgent(source.id)}>Run AI agent</button></div></div>
                <pre className="mt-3 max-h-40 overflow-auto rounded-lg bg-bg-tertiary p-3 text-xs text-text-secondary">{pretty(source.payload)}</pre>
                {source.notes && <p className="mt-2 text-xs text-text-tertiary">Reviewer note: {source.notes}</p>}
                {(suggestions[source.id] ?? []).map((candidate) => <div key={candidate.master_record_id} className="mt-2 flex flex-wrap items-center justify-between gap-2 rounded-lg bg-bg-tertiary p-3"><div><p className="text-sm font-semibold text-text-primary">#{candidate.master_record_id} · {String(candidate.attributes.name ?? candidate.attributes.label ?? 'Golden record')}</p><p className="text-xs text-text-tertiary">Match score {candidate.score.toFixed(3)}</p></div><button type="button" className={buttonClass} onClick={() => void approve(source, candidate.master_record_id)}>Approve this link</button></div>)}
                <div className="mt-3 flex flex-wrap gap-2"><button type="button" className={secondaryButton} onClick={() => void approve(source)}>Create new golden record</button><button type="button" className={secondaryButton} onClick={() => void reject(source.id)}>Reject</button></div>
                {agentResults[source.id] && <details className="mt-3 rounded-lg bg-bg-tertiary p-3"><summary className="cursor-pointer text-xs font-bold text-text-secondary">AI run: {agentResults[source.id].status}</summary><p className="mt-2 text-xs text-text-secondary">{agentResults[source.id].summary ?? agentResults[source.id].error}</p><pre className="mt-2 overflow-auto text-xs text-text-tertiary">{pretty(agentResults[source.id].steps)}</pre></details>}
              </article>
            ))}
          </section>
        </div>
      )}

      {tab === 'quality' && activeEntity && (
        <div className="grid gap-5 xl:grid-cols-2">
          <section className={`${panelClass} space-y-4`}>
            <div className="flex items-center justify-between"><div><h2 className="font-bold text-text-primary">Data quality</h2><p className="mt-1 text-xs text-text-tertiary">Rules are evaluated on demand from the entity configuration.</p></div><button type="button" className={secondaryButton} onClick={() => void loadWorkspace(entityCode)}>Recalculate</button></div>
            <div className="grid grid-cols-3 gap-3 text-center"><div className="rounded-xl bg-bg-tertiary p-3"><p className="text-xl font-black text-text-primary">{quality?.total_records ?? 0}</p><p className="text-[10px] uppercase text-text-tertiary">Records</p></div><div className="rounded-xl bg-bg-tertiary p-3"><p className="text-xl font-black text-brand-success">{quality?.compliant_records ?? 0}</p><p className="text-[10px] uppercase text-text-tertiary">Compliant</p></div><div className="rounded-xl bg-bg-tertiary p-3"><p className="text-xl font-black text-text-primary">{Math.round((quality?.average_score ?? 1) * 100)}%</p><p className="text-[10px] uppercase text-text-tertiary">Average score</p></div></div>
            {(quality?.records ?? []).map((item) => <article key={item.record.id} className="rounded-xl border border-widget-border p-3"><div className="flex justify-between gap-3"><p className="text-sm font-bold text-text-primary">#{item.record.id} · {labelFor(item.record)}</p><p className="text-xs font-bold text-text-secondary">{Math.round(item.score * 100)}%</p></div>{item.violations.length > 0 ? <ul className="mt-2 list-inside list-disc text-xs text-brand-danger">{item.violations.map((violation) => <li key={violation}>{violation}</li>)}</ul> : <p className="mt-2 text-xs text-brand-success">No violations</p>}</article>)}
          </section>
          <section className={`${panelClass} space-y-4`}>
            <div><h2 className="font-bold text-text-primary">Record hierarchy</h2><p className="mt-1 text-xs text-text-tertiary">Add typed parent-child links. Cycles are rejected by the API.</p></div>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="space-y-1 text-xs text-text-tertiary">Parent<select className={inputClass} value={parentId} onChange={(event) => setParentId(event.target.value)}><option value="">Choose record…</option>{activeRecords.map((record) => <option key={record.id} value={record.id}>#{record.id} · {labelFor(record)}</option>)}</select></label>
              <label className="space-y-1 text-xs text-text-tertiary">Child<select className={inputClass} value={childId} onChange={(event) => setChildId(event.target.value)}><option value="">Choose record…</option>{activeRecords.map((record) => <option key={record.id} value={record.id}>#{record.id} · {labelFor(record)}</option>)}</select></label>
            </div>
            <div className="flex gap-2"><input className={inputClass} aria-label="Relation type" value={relationType} onChange={(event) => setRelationType(event.target.value)} /><button type="button" className={buttonClass} onClick={() => void addLink()} disabled={!parentId || !childId}>Add link</button></div>
            {links.length === 0 ? <p className="text-sm text-text-tertiary">No hierarchy links yet.</p> : links.map((link) => {
              const parent = records.find((record) => record.id === link.parent_id);
              const child = records.find((record) => record.id === link.child_id);
              return <article key={link.id} className="flex items-center justify-between gap-3 rounded-xl border border-widget-border p-3"><p className="text-xs text-text-secondary">{parent ? labelFor(parent) : `#${link.parent_id}`} <span className="text-text-tertiary">— {link.relation_type} →</span> {child ? labelFor(child) : `#${link.child_id}`}</p><button type="button" className={secondaryButton} onClick={async () => { try { await deleteMasterRecordLink(link.id); await loadWorkspace(entityCode); } catch (error) { onToast({ type: 'error', content: errorText(error) }); } }}>Remove</button></article>;
            })}
          </section>
        </div>
      )}
    </div>
  );
};

export default MDMPage;
