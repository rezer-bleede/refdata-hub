import type {
  CanonicalValue,
  MatchResponse,
  SystemConfig,
  SystemConfigUpdate,
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

export async function createCanonicalValue(payload: Partial<CanonicalValue>): Promise<CanonicalValue> {
  const response = await fetch(`${API_BASE_URL}/api/reference/canonical`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return handleResponse<CanonicalValue>(response);
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
