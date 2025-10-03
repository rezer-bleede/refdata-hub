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
  SourceFieldMapping,
  SourceFieldMappingPayload,
  SourceSample,
  SourceSampleValuePayload,
  SystemConfig,
  SystemConfigUpdate,
  UnmatchedValueRecord,
  ValueMapping,
  ValueMappingExpanded,
  ValueMappingPayload,
  ValueMappingUpdatePayload,
} from './types';

const fallbackBaseUrl = () => {
  if (typeof window === 'undefined') {
    return 'http://localhost:8000';
  }

  if (window.location.port) {
    return `${window.location.protocol}//${window.location.hostname}:8000`;
  }

  return `${window.location.origin}:8000`;
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

interface RequestContext {
  response: Response;
  url: string;
  method: string;
}

async function performRequest(path: string, init?: RequestInit): Promise<RequestContext> {
  const method = init?.method ?? 'GET';
  const url = `${API_BASE_URL}${normalisePath(path)}`;

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

export async function deleteValueMapping(connectionId: number, mappingId: number): Promise<void> {
  await apiFetchVoid(`/api/source/connections/${connectionId}/value-mappings/${mappingId}`, { method: 'DELETE' });
}
