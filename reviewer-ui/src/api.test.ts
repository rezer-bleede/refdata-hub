/// <reference types="vitest" />

import { afterEach, describe, expect, it, vi } from 'vitest';

const buildConfigPayload = () => ({
  default_dimension: 'general',
  match_threshold: 0.6,
  matcher_backend: 'embedding',
  embedding_model: 'tfidf',
  llm_mode: 'online',
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

  it('sends connection testing and metadata requests to the backend', async () => {
    vi.stubGlobal('__API_BASE_URL__', '');
    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url.includes('/connections/test')) {
        return Promise.resolve(
          new Response(JSON.stringify({ success: true, message: 'ok', latency_ms: 12.5 }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }),
        );
      }
      if (url.endsWith('/tables')) {
        return Promise.resolve(
          new Response(
            JSON.stringify([{ name: 'customers', schema: 'public', type: 'table' }]),
            {
              status: 200,
              headers: { 'Content-Type': 'application/json' },
            },
          ),
        );
      }
      if (url.includes('/fields')) {
        return Promise.resolve(
          new Response(JSON.stringify([{ name: 'id', data_type: 'integer' }]), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }),
        );
      }
      return Promise.resolve(
        new Response(JSON.stringify([]), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      );
    });
    vi.stubGlobal('fetch', fetchMock);

    const {
      testSourceConnection,
      testExistingSourceConnection,
      fetchSourceTables,
      fetchSourceFields,
    } = await import('./api');

    await testSourceConnection({
      name: 'local',
      db_type: 'postgres',
      host: 'localhost',
      port: 5432,
      database: 'analytics',
      username: 'svc',
      password: 'secret',
    });
    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:8000/api/source/connections/test',
      expect.objectContaining({ method: 'POST' }),
    );
    const firstBody = JSON.parse((fetchMock.mock.calls[0][1]?.body as string) ?? '{}');
    expect(firstBody).toMatchObject({ db_type: 'postgres', password: 'secret' });

    fetchMock.mockClear();

    await testExistingSourceConnection(3, { host: 'db.internal', password: 'override' });
    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:8000/api/source/connections/3/test',
      expect.objectContaining({ method: 'POST' }),
    );
    const overridePayload = JSON.parse((fetchMock.mock.calls[0][1]?.body as string) ?? '{}');
    expect(overridePayload).toMatchObject({ host: 'db.internal', password: 'override' });

    fetchMock.mockClear();

    await fetchSourceTables(5);
    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:8000/api/source/connections/5/tables',
      undefined,
    );

    fetchMock.mockClear();

    await fetchSourceFields(5, 'customers', 'public');
    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:8000/api/source/connections/5/tables/customers/fields?schema=public',
      undefined,
    );
  });

  it('exports and imports value mappings', async () => {
    vi.stubGlobal('__API_BASE_URL__', '');
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url.includes('/export')) {
        return Promise.resolve(new Response('raw_value,canonical_id\nCA,1', { status: 200 }));
      }
      if (url.includes('/import')) {
        return Promise.resolve(
          new Response(JSON.stringify({ created: 1, updated: 0, errors: [] }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }),
        );
      }
      return Promise.reject(new Error('unexpected request'));
    });
    vi.stubGlobal('fetch', fetchMock);

    const { exportValueMappings, importValueMappings } = await import('./api');

    const blob = await exportValueMappings('all', 'csv');
    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:8000/api/source/value-mappings/export?format=csv',
      undefined,
    );
    expect(blob.size).toBeGreaterThan(0);

    const file = new File(['raw_value,canonical_id\nCA,1'], 'mappings.csv', { type: 'text/csv' });
    const result = await importValueMappings(file, 7);
    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:8000/api/source/value-mappings/import?connection_id=7',
      expect.objectContaining({ method: 'POST' }),
    );
    expect(result.created).toBe(1);
    expect(result.errors).toHaveLength(0);
  });
});
