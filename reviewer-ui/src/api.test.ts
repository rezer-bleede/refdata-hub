/// <reference types="vitest" />

import { afterEach, describe, expect, it, vi } from 'vitest';

const buildConfigPayload = () => ({
  default_dimension: 'general',
  match_threshold: 0.6,
  matcher_backend: 'embedding',
  embedding_model: 'tfidf',
  llm_model: null,
  llm_api_base: null,
  top_k: 5,
  llm_api_key_set: false,
});

afterEach(() => {
  vi.resetModules();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('api client helpers', () => {
  it('normalises the configured API base URL before issuing requests', async () => {
    vi.stubGlobal('__API_BASE_URL__', 'https://example.test/');
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(buildConfigPayload()), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const { fetchConfig } = await import('./api');
    const payload = await fetchConfig();

    expect(fetchMock).toHaveBeenCalledWith('https://example.test/api/config', undefined);
    expect(payload.default_dimension).toBe('general');
  });

  it('logs failure details when the backend responds with an error', async () => {
    vi.stubGlobal('__API_BASE_URL__', '');
    const fetchMock = vi.fn().mockResolvedValue(
      new Response('backend exploded', {
        status: 503,
        statusText: 'Service Unavailable',
      }),
    );
    vi.stubGlobal('fetch', fetchMock);
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const { fetchCanonicalValues, getApiBaseUrl } = await import('./api');

    await expect(fetchCanonicalValues()).rejects.toThrowError('backend exploded');
    expect(getApiBaseUrl()).toBe('http://localhost:8000');
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('[api] GET http://localhost:8000/api/reference/canonical failed'),
      expect.objectContaining({ status: 503, statusText: 'Service Unavailable', body: 'backend exploded' }),
    );
  });
});
