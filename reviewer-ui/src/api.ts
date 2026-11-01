import type {
  BulkImportPreview,
  BulkImportResult,
  CanonicalValue,
  CanonicalValueUpdatePayload,
  DimensionCreatePayload,
  DimensionDefinition,
  DimensionRelationCreatePayload,
  DimensionRelationLink,
  DimensionRelationLinkPayload,
  DimensionRelationSummary,
  DimensionRelationUpdatePayload,
  DimensionUpdatePayload,
  FieldMatchStats,
  MatchResponse,
  SourceConnection,
  SourceConnectionCreatePayload,
  SourceConnectionUpdatePayload,
  SourceConnectionTestPayload,
  SourceConnectionTestResult,
  SourceFieldMapping,
  SourceFieldMappingPayload,
  SourceFieldMetadata,
  SourceSample,
  SourceSampleValuePayload,
  SourceTableMetadata,
  SystemConfig,
  SystemConfigUpdate,
  UnmatchedValueRecord,
  ValueMapping,
  ValueMappingExpanded,
  ValueMappingPayload,
  ValueMappingImportResult,
  ValueMappingClusterReviewResult,
  ValueMappingUpdatePayload,
  EntityQualityReport,
  MasterEntity,
  MasterEntityPayload,
  MasterRecord,
  MasterRecordLink,
  SourceRecord,
  MDMCandidate,
  MDMAgentResult,
  MergeHistoryEntry,
} from './types';

const fallbackBaseUrl = () => {
  if (typeof window === 'undefined') {
    return 'http://localhost:8000';
  }

  const hostname = window.location.hostname.toLowerCase();
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return 'http://localhost:8000';
  }

  console.warn('[api] VITE_API_BASE_URL is not set; defaulting to same-origin /api');
  return '/api';
};

const configuredBaseUrl =
  typeof __API_BASE_URL__ !== 'undefined' && __API_BASE_URL__ ? __API_BASE_URL__ : fallbackBaseUrl();

const API_BASE_URL = configuredBaseUrl.replace(/\/+$/, '');

const truncate = (value: string, limit = 500) => {
  if (value.length <= limit) {
    return value;
  }
  return `${value.slice(0, limit)}…`;
};

const normalisePath = (path: string) => (path.startsWith('/') ? path : `/${path}`);

const buildRequestUrl = (baseUrl: string, path: string): string => {
  const normalizedBase = baseUrl.replace(/\/+$/, '');
  const normalizedPath = normalisePath(path);

  if (!normalizedBase) {
    return normalizedPath;
  }

  if (normalizedBase.endsWith('/api') && normalizedPath.startsWith('/api/')) {
    return `${normalizedBase}${normalizedPath.slice(4)}`;
  }

  if (normalizedBase === '/api' && normalizedPath === '/api') {
    return '/api';
  }

  return `${normalizedBase}${normalizedPath}`;
};

interface RequestContext {
  response: Response;
  url: string;
  method: string;
}

async function performRequest(path: string, init?: RequestInit): Promise<RequestContext> {
  const method = init?.method ?? 'GET';
  const url = buildRequestUrl(API_BASE_URL, path);

  console.debug(`[api] ${method} ${url}`);

  try {
    const response = await fetch(url, init);
    return { response, url, method };
  } catch (error) {
    console.error(`[api] ${method} ${url} network error`, error);
    throw error instanceof Error ? error : new Error('Network request failed');
  }
}

async function apiFetchJson<T>(path: string, init?: RequestInit): Promise<T> {
  const { response, url, method } = await performRequest(path, init);

  if (!response.ok) {
    const body = truncate(await response.text());
    console.error(`[api] ${method} ${url} failed`, {
      status: response.status,
      statusText: response.statusText,
      body,
    });
    throw new Error(body || `Request failed with status ${response.status}`);
  }

  const data = (await response.json()) as T;
  console.debug(`[api] ${method} ${url} <- ${response.status}`);
  return data;
}

async function apiFetchVoid(path: string, init?: RequestInit): Promise<void> {
  const { response, url, method } = await performRequest(path, init);

  if (!response.ok) {
    const body = truncate(await response.text());
    console.error(`[api] ${method} ${url} failed`, {
      status: response.status,
      statusText: response.statusText,
      body,
    });
    throw new Error(body || `Request failed with status ${response.status}`);
  }

  console.debug(`[api] ${method} ${url} <- ${response.status}`);
}

async function apiFetchBlob(path: string, init?: RequestInit): Promise<Blob> {
  const { response, url, method } = await performRequest(path, init);

  if (!response.ok) {
    const body = truncate(await response.text());
    console.error(`[api] ${method} ${url} failed`, {
      status: response.status,
      statusText: response.statusText,
      body,
    });
    throw new Error(body || `Request failed with status ${response.status}`);
  }

  console.debug(`[api] ${method} ${url} <- ${response.status}`);
  return await response.blob();
}

export function getApiBaseUrl(): string {
  return API_BASE_URL;
}

export async function fetchCanonicalValues(): Promise<CanonicalValue[]> {
  return apiFetchJson<CanonicalValue[]>('/api/reference/canonical');
}

export async function createCanonicalValue(payload: CanonicalValueUpdatePayload): Promise<CanonicalValue> {
  return apiFetchJson<CanonicalValue>('/api/reference/canonical', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

export async function updateCanonicalValue(
  id: number,
  payload: CanonicalValueUpdatePayload,
): Promise<CanonicalValue> {
  return apiFetchJson<CanonicalValue>(`/api/reference/canonical/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

export async function deleteCanonicalValue(id: number): Promise<void> {
  await apiFetchVoid(`/api/reference/canonical/${id}`, { method: 'DELETE' });
}

export async function bulkImportCanonicalValues(formData: FormData): Promise<BulkImportResult> {
  return apiFetchJson<BulkImportResult>('/api/reference/canonical/import', {
    method: 'POST',
    body: formData,
  });
}

export async function previewBulkImportCanonicalValues(formData: FormData): Promise<BulkImportPreview> {
  return apiFetchJson<BulkImportPreview>('/api/reference/canonical/import/preview', {
    method: 'POST',
    body: formData,
  });
}

export async function proposeMatch(raw_text: string, dimension?: string): Promise<MatchResponse> {
  return apiFetchJson<MatchResponse>('/api/reference/propose', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ raw_text, dimension }),
  });
}

export async function fetchDimensions(): Promise<DimensionDefinition[]> {
  return apiFetchJson<DimensionDefinition[]>('/api/reference/dimensions');
}

export async function createDimension(payload: DimensionCreatePayload): Promise<DimensionDefinition> {
  return apiFetchJson<DimensionDefinition>('/api/reference/dimensions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

export async function updateDimension(
  code: string,
  payload: DimensionUpdatePayload,
): Promise<DimensionDefinition> {
  return apiFetchJson<DimensionDefinition>(`/api/reference/dimensions/${encodeURIComponent(code)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

export async function deleteDimension(code: string): Promise<void> {
  await apiFetchVoid(`/api/reference/dimensions/${encodeURIComponent(code)}`, { method: 'DELETE' });
}

export async function fetchDimensionRelations(): Promise<DimensionRelationSummary[]> {
  return apiFetchJson<DimensionRelationSummary[]>('/api/reference/dimension-relations');
}

export async function createDimensionRelation(
  payload: DimensionRelationCreatePayload,
): Promise<DimensionRelationSummary> {
  return apiFetchJson<DimensionRelationSummary>('/api/reference/dimension-relations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

export async function updateDimensionRelation(
  relationId: number,
  payload: DimensionRelationUpdatePayload,
): Promise<DimensionRelationSummary> {
  return apiFetchJson<DimensionRelationSummary>(`/api/reference/dimension-relations/${relationId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

export async function deleteDimensionRelation(relationId: number): Promise<void> {
  await apiFetchVoid(`/api/reference/dimension-relations/${relationId}`, { method: 'DELETE' });
}

export async function fetchDimensionRelationLinks(
  relationId: number,
): Promise<DimensionRelationLink[]> {
  return apiFetchJson<DimensionRelationLink[]>(`/api/reference/dimension-relations/${relationId}/links`);
}

export async function createDimensionRelationLink(
  relationId: number,
  payload: DimensionRelationLinkPayload,
): Promise<DimensionRelationLink> {
  return apiFetchJson<DimensionRelationLink>(`/api/reference/dimension-relations/${relationId}/links`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

export async function deleteDimensionRelationLink(
  relationId: number,
  linkId: number,
): Promise<void> {
  await apiFetchVoid(`/api/reference/dimension-relations/${relationId}/links/${linkId}`, { method: 'DELETE' });
}

export async function fetchConfig(): Promise<SystemConfig> {
  return apiFetchJson<SystemConfig>('/api/config');
}

export async function updateConfig(payload: SystemConfigUpdate): Promise<SystemConfig> {
  return apiFetchJson<SystemConfig>('/api/config', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

export async function fetchSourceConnections(): Promise<SourceConnection[]> {
  return apiFetchJson<SourceConnection[]>('/api/source/connections');
}

export async function fetchSourceConnection(connectionId: number): Promise<SourceConnection> {
  return apiFetchJson<SourceConnection>(`/api/source/connections/${connectionId}`);
}

export async function createSourceConnection(
  payload: SourceConnectionCreatePayload,
): Promise<SourceConnection> {
  return apiFetchJson<SourceConnection>('/api/source/connections', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

export async function updateSourceConnection(
  id: number,
  payload: SourceConnectionUpdatePayload,
): Promise<SourceConnection> {
  return apiFetchJson<SourceConnection>(`/api/source/connections/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

export async function deleteSourceConnection(id: number): Promise<void> {
  await apiFetchVoid(`/api/source/connections/${id}`, { method: 'DELETE' });
}

export async function testSourceConnection(
  payload: SourceConnectionTestPayload,
): Promise<SourceConnectionTestResult> {
  const body = {
    ...payload,
    password: payload.password ? payload.password : undefined,
    options:
      payload.options === undefined || payload.options === null || payload.options === ''
        ? undefined
        : payload.options,
  };

  return apiFetchJson<SourceConnectionTestResult>('/api/source/connections/test', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export async function testExistingSourceConnection(
  connectionId: number,
  overrides?: SourceConnectionUpdatePayload,
): Promise<SourceConnectionTestResult> {
  let body: string | undefined;
  if (overrides) {
    const sanitised: Record<string, unknown> = {};
    Object.entries(overrides).forEach(([key, value]) => {
      if (value === undefined || value === null) {
        return;
      }
      if (key === 'password' && value === '') {
        return;
      }
      if (key === 'options' && value === '') {
        return;
      }
      sanitised[key] = value;
    });

    if (Object.keys(sanitised).length > 0) {
      body = JSON.stringify(sanitised);
    }
  }

  return apiFetchJson<SourceConnectionTestResult>(
    `/api/source/connections/${connectionId}/test`,
    body
      ? {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body,
        }
      : { method: 'POST' },
  );
}

export async function fetchSourceTables(connectionId: number): Promise<SourceTableMetadata[]> {
  return apiFetchJson<SourceTableMetadata[]>(`/api/source/connections/${connectionId}/tables`);
}

export async function fetchSourceFields(
  connectionId: number,
  tableName: string,
  schema?: string | null,
): Promise<SourceFieldMetadata[]> {
  const params = new URLSearchParams();
  if (schema) {
    params.set('schema', schema);
  }
  const query = params.toString();
  const suffix = query ? `?${query}` : '';
  return apiFetchJson<SourceFieldMetadata[]>(
    `/api/source/connections/${connectionId}/tables/${encodeURIComponent(tableName)}/fields${suffix}`,
  );
}

export async function fetchFieldMappings(connectionId: number): Promise<SourceFieldMapping[]> {
  return apiFetchJson<SourceFieldMapping[]>(`/api/source/connections/${connectionId}/mappings`);
}

export async function createFieldMapping(
  connectionId: number,
  payload: SourceFieldMappingPayload,
): Promise<SourceFieldMapping> {
  return apiFetchJson<SourceFieldMapping>(`/api/source/connections/${connectionId}/mappings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

export async function updateFieldMapping(
  connectionId: number,
  mappingId: number,
  payload: SourceFieldMappingPayload,
): Promise<SourceFieldMapping> {
  return apiFetchJson<SourceFieldMapping>(`/api/source/connections/${connectionId}/mappings/${mappingId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

export async function deleteFieldMapping(connectionId: number, mappingId: number): Promise<void> {
  await apiFetchVoid(`/api/source/connections/${connectionId}/mappings/${mappingId}`, { method: 'DELETE' });
}

export async function captureMappingSamples(
  connectionId: number,
  mappingId: number,
): Promise<SourceSample[]> {
  return apiFetchJson<SourceSample[]>(`/api/source/connections/${connectionId}/mappings/${mappingId}/capture`, {
    method: 'POST',
  });
}

export async function ingestSamples(
  connectionId: number,
  source_table: string,
  source_field: string,
  values: SourceSampleValuePayload[],
): Promise<SourceSample[]> {
  return apiFetchJson<SourceSample[]>(`/api/source/connections/${connectionId}/samples`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ source_table, source_field, values }),
  });
}

export async function fetchSourceSamples(
  connectionId: number,
  options?: { source_table?: string; source_field?: string },
): Promise<SourceSample[]> {
  const params = new URLSearchParams();
  if (options?.source_table) {
    params.set('source_table', options.source_table);
  }
  if (options?.source_field) {
    params.set('source_field', options.source_field);
  }
  const query = params.toString();
  const suffix = query ? `?${query}` : '';
  return apiFetchJson<SourceSample[]>(`/api/source/connections/${connectionId}/samples${suffix}`);
}

export async function fetchMatchStatistics(connectionId: number): Promise<FieldMatchStats[]> {
  return apiFetchJson<FieldMatchStats[]>(`/api/source/connections/${connectionId}/match-stats`);
}

export async function fetchUnmatchedValues(connectionId: number): Promise<UnmatchedValueRecord[]> {
  return apiFetchJson<UnmatchedValueRecord[]>(`/api/source/connections/${connectionId}/unmatched`);
}

export async function createValueMapping(
  connectionId: number,
  payload: ValueMappingPayload,
): Promise<ValueMapping> {
  return apiFetchJson<ValueMapping>(`/api/source/connections/${connectionId}/value-mappings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

export async function fetchConnectionValueMappings(connectionId: number): Promise<ValueMappingExpanded[]> {
  return apiFetchJson<ValueMappingExpanded[]>(`/api/source/connections/${connectionId}/value-mappings`);
}

export async function fetchAllValueMappings(): Promise<ValueMappingExpanded[]> {
  return apiFetchJson<ValueMappingExpanded[]>('/api/source/value-mappings');
}

export async function exportValueMappings(
  connectionId: number | 'all' | undefined,
  format: 'csv' | 'xlsx',
): Promise<Blob> {
  const params = new URLSearchParams({ format });
  if (connectionId !== undefined && connectionId !== 'all') {
    params.set('connection_id', String(connectionId));
  }

  const query = params.toString();
  return apiFetchBlob(`/api/source/value-mappings/export?${query}`);
}

export async function importValueMappings(
  file: File,
  connectionId?: number,
): Promise<ValueMappingImportResult> {
  const params = new URLSearchParams();
  if (connectionId !== undefined) {
    params.set('connection_id', String(connectionId));
  }
  const suffix = params.toString();
  const path = suffix
    ? `/api/source/value-mappings/import?${suffix}`
    : '/api/source/value-mappings/import';

  const formData = new FormData();
  formData.append('file', file);

  return apiFetchJson<ValueMappingImportResult>(path, {
    method: 'POST',
    body: formData,
  });
}

export async function updateValueMapping(
  connectionId: number,
  mappingId: number,
  payload: ValueMappingUpdatePayload,
): Promise<ValueMapping> {
  return apiFetchJson<ValueMapping>(`/api/source/connections/${connectionId}/value-mappings/${mappingId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

export async function reviewValueMappingCluster(
  connectionId: number,
  clusterId: string,
  status: 'approved' | 'rejected',
): Promise<ValueMappingClusterReviewResult> {
  return apiFetchJson<ValueMappingClusterReviewResult>(
    `/api/source/connections/${connectionId}/value-mappings/review-cluster`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cluster_id: clusterId, status }),
    },
  );
}

export async function deleteValueMapping(connectionId: number, mappingId: number): Promise<void> {
  await apiFetchVoid(`/api/source/connections/${connectionId}/value-mappings/${mappingId}`, { method: 'DELETE' });
}

export async function fetchMasterEntities(): Promise<MasterEntity[]> {
  return apiFetchJson<MasterEntity[]>('/api/mdm/entities');
}

export async function createMasterEntity(payload: MasterEntityPayload): Promise<MasterEntity> {
  return apiFetchJson<MasterEntity>('/api/mdm/entities', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
  });
}

export async function updateMasterEntity(code: string, payload: Partial<MasterEntityPayload>): Promise<MasterEntity> {
  return apiFetchJson<MasterEntity>(`/api/mdm/entities/${encodeURIComponent(code)}`, {
    method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
  });
}

export async function deleteMasterEntity(code: string): Promise<void> {
  await apiFetchVoid(`/api/mdm/entities/${encodeURIComponent(code)}`, { method: 'DELETE' });
}

export async function fetchMasterRecords(entityCode: string, includeMerged = false): Promise<MasterRecord[]> {
  const params = new URLSearchParams({ entity_code: entityCode, include_merged: String(includeMerged) });
  return apiFetchJson<MasterRecord[]>(`/api/mdm/records?${params}`);
}

export async function createMasterRecord(entity_code: string, attributes: Record<string, unknown>): Promise<MasterRecord> {
  return apiFetchJson<MasterRecord>('/api/mdm/records', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ entity_code, attributes }),
  });
}

export async function updateMasterRecord(id: number, attributes: Record<string, unknown>): Promise<MasterRecord> {
  return apiFetchJson<MasterRecord>(`/api/mdm/records/${id}`, {
    method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ attributes }),
  });
}

export async function fetchMDMSourceRecords(entityCode: string): Promise<SourceRecord[]> {
  const params = new URLSearchParams({ entity_code: entityCode });
  return apiFetchJson<SourceRecord[]>(`/api/mdm/source-records?${params}`);
}

export async function ingestMDMSourceRecords(payload: {
  source_connection_id: number;
  entity_code: string;
  source_table: string;
  records: Array<{ source_pk: string; payload: Record<string, unknown>; source_priority?: number; source_updated_at?: string }>;
}): Promise<{ created: number; updated: number; records: SourceRecord[] }> {
  return apiFetchJson('/api/mdm/source-records', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
  });
}

export async function suggestMDMMatches(sourceRecordId: number): Promise<MDMCandidate[]> {
  const result = await apiFetchJson<{ candidates: MDMCandidate[] }>(`/api/mdm/source-records/${sourceRecordId}/suggestions`, { method: 'POST' });
  return result.candidates;
}

export async function approveMDMSourceRecord(sourceRecordId: number, masterRecordId?: number): Promise<SourceRecord> {
  return apiFetchJson<SourceRecord>(`/api/mdm/source-records/${sourceRecordId}/approve`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ master_record_id: masterRecordId }),
  });
}

export async function rejectMDMSourceRecord(sourceRecordId: number): Promise<SourceRecord> {
  return apiFetchJson<SourceRecord>(`/api/mdm/source-records/${sourceRecordId}/reject`, { method: 'POST' });
}

export async function runMDMAgent(sourceRecordId: number): Promise<MDMAgentResult> {
  return apiFetchJson<MDMAgentResult>('/api/agent/mdm/harmonize', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ source_record_id: sourceRecordId }),
  });
}

export async function mergeMasterRecord(recordId: number, survivorId: number): Promise<MasterRecord> {
  return apiFetchJson<MasterRecord>(`/api/mdm/records/${recordId}/merge`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ survivor_id: survivorId }),
  });
}

export async function unmergeMasterRecord(recordId: number): Promise<MasterRecord> {
  return apiFetchJson<MasterRecord>(`/api/mdm/records/${recordId}/unmerge`, { method: 'POST' });
}

export async function fetchMasterRecordHistory(recordId: number): Promise<MergeHistoryEntry[]> {
  return apiFetchJson<MergeHistoryEntry[]>(`/api/mdm/records/${recordId}/history`);
}

export async function fetchMasterRecordLinks(entityCode: string): Promise<MasterRecordLink[]> {
  const params = new URLSearchParams({ entity_code: entityCode });
  return apiFetchJson<MasterRecordLink[]>(`/api/mdm/links?${params}`);
}

export async function createMasterRecordLink(payload: Pick<MasterRecordLink, 'parent_id' | 'child_id' | 'relation_type'>): Promise<MasterRecordLink> {
  return apiFetchJson<MasterRecordLink>('/api/mdm/links', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
  });
}

export async function deleteMasterRecordLink(linkId: number): Promise<void> {
  await apiFetchVoid(`/api/mdm/links/${linkId}`, { method: 'DELETE' });
}

export async function fetchEntityQuality(code: string): Promise<EntityQualityReport> {
  return apiFetchJson<EntityQualityReport>(`/api/mdm/entities/${encodeURIComponent(code)}/quality`);
}
