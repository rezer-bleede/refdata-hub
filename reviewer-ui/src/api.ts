import type {
  CanonicalValue,
  CanonicalValueUpdatePayload,
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

const API_BASE_URL: string =
  (typeof __API_BASE_URL__ !== 'undefined' && __API_BASE_URL__)
    ? __API_BASE_URL__
    : fallbackBaseUrl();

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || 'Request failed');
  }
  return response.json() as Promise<T>;
}

export async function fetchCanonicalValues(): Promise<CanonicalValue[]> {
  const response = await fetch(`${API_BASE_URL}/api/reference/canonical`);
  return handleResponse<CanonicalValue[]>(response);
}

export async function createCanonicalValue(payload: CanonicalValueUpdatePayload): Promise<CanonicalValue> {
  const response = await fetch(`${API_BASE_URL}/api/reference/canonical`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return handleResponse<CanonicalValue>(response);
}

export async function updateCanonicalValue(
  id: number,
  payload: CanonicalValueUpdatePayload,
): Promise<CanonicalValue> {
  const response = await fetch(`${API_BASE_URL}/api/reference/canonical/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return handleResponse<CanonicalValue>(response);
}

export async function deleteCanonicalValue(id: number): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/api/reference/canonical/${id}`, {
    method: 'DELETE',
  });
  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || 'Unable to delete canonical value');
  }
}

export async function proposeMatch(raw_text: string, dimension?: string): Promise<MatchResponse> {
  const response = await fetch(`${API_BASE_URL}/api/reference/propose`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ raw_text, dimension }),
  });
  return handleResponse<MatchResponse>(response);
}

export async function fetchConfig(): Promise<SystemConfig> {
  const response = await fetch(`${API_BASE_URL}/api/config`);
  return handleResponse<SystemConfig>(response);
}

export async function updateConfig(payload: SystemConfigUpdate): Promise<SystemConfig> {
  const response = await fetch(`${API_BASE_URL}/api/config`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return handleResponse<SystemConfig>(response);
}

export async function fetchSourceConnections(): Promise<SourceConnection[]> {
  const response = await fetch(`${API_BASE_URL}/api/source/connections`);
  return handleResponse<SourceConnection[]>(response);
}

export async function createSourceConnection(
  payload: SourceConnectionCreatePayload,
): Promise<SourceConnection> {
  const response = await fetch(`${API_BASE_URL}/api/source/connections`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return handleResponse<SourceConnection>(response);
}

export async function updateSourceConnection(
  id: number,
  payload: SourceConnectionUpdatePayload,
): Promise<SourceConnection> {
  const response = await fetch(`${API_BASE_URL}/api/source/connections/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return handleResponse<SourceConnection>(response);
}

export async function deleteSourceConnection(id: number): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/api/source/connections/${id}`, {
    method: 'DELETE',
  });
  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || 'Unable to delete connection');
  }
}

export async function fetchFieldMappings(
  connectionId: number,
): Promise<SourceFieldMapping[]> {
  const response = await fetch(
    `${API_BASE_URL}/api/source/connections/${connectionId}/mappings`,
  );
  return handleResponse<SourceFieldMapping[]>(response);
}

export async function createFieldMapping(
  connectionId: number,
  payload: SourceFieldMappingPayload,
): Promise<SourceFieldMapping> {
  const response = await fetch(
    `${API_BASE_URL}/api/source/connections/${connectionId}/mappings`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    },
  );
  return handleResponse<SourceFieldMapping>(response);
}

export async function updateFieldMapping(
  connectionId: number,
  mappingId: number,
  payload: SourceFieldMappingPayload,
): Promise<SourceFieldMapping> {
  const response = await fetch(
    `${API_BASE_URL}/api/source/connections/${connectionId}/mappings/${mappingId}`,
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    },
  );
  return handleResponse<SourceFieldMapping>(response);
}

export async function deleteFieldMapping(
  connectionId: number,
  mappingId: number,
): Promise<void> {
  const response = await fetch(
    `${API_BASE_URL}/api/source/connections/${connectionId}/mappings/${mappingId}`,
    { method: 'DELETE' },
  );
  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || 'Unable to delete mapping');
  }
}

export async function ingestSamples(
  connectionId: number,
  source_table: string,
  source_field: string,
  values: SourceSampleValuePayload[],
): Promise<SourceSample[]> {
  const response = await fetch(
    `${API_BASE_URL}/api/source/connections/${connectionId}/samples`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ source_table, source_field, values }),
    },
  );
  return handleResponse<SourceSample[]>(response);
}

export async function fetchMatchStatistics(
  connectionId: number,
): Promise<FieldMatchStats[]> {
  const response = await fetch(
    `${API_BASE_URL}/api/source/connections/${connectionId}/match-stats`,
  );
  return handleResponse<FieldMatchStats[]>(response);
}

export async function fetchUnmatchedValues(
  connectionId: number,
): Promise<UnmatchedValueRecord[]> {
  const response = await fetch(
    `${API_BASE_URL}/api/source/connections/${connectionId}/unmatched`,
  );
  return handleResponse<UnmatchedValueRecord[]>(response);
}

export async function createValueMapping(
  connectionId: number,
  payload: ValueMappingPayload,
): Promise<ValueMapping> {
  const response = await fetch(
    `${API_BASE_URL}/api/source/connections/${connectionId}/value-mappings`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    },
  );
  return handleResponse<ValueMapping>(response);
}

export async function fetchConnectionValueMappings(
  connectionId: number,
): Promise<ValueMappingExpanded[]> {
  const response = await fetch(
    `${API_BASE_URL}/api/source/connections/${connectionId}/value-mappings`,
  );
  return handleResponse<ValueMappingExpanded[]>(response);
}

export async function fetchAllValueMappings(): Promise<ValueMappingExpanded[]> {
  const response = await fetch(`${API_BASE_URL}/api/source/value-mappings`);
  return handleResponse<ValueMappingExpanded[]>(response);
}

export async function updateValueMapping(
  connectionId: number,
  mappingId: number,
  payload: ValueMappingUpdatePayload,
): Promise<ValueMapping> {
  const response = await fetch(
    `${API_BASE_URL}/api/source/connections/${connectionId}/value-mappings/${mappingId}`,
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    },
  );
  return handleResponse<ValueMapping>(response);
}

export async function deleteValueMapping(
  connectionId: number,
  mappingId: number,
): Promise<void> {
  const response = await fetch(
    `${API_BASE_URL}/api/source/connections/${connectionId}/value-mappings/${mappingId}`,
    {
      method: 'DELETE',
    },
  );
  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || 'Unable to delete value mapping');
  }
}
