import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import App from './App';
import { THEME_STORAGE_KEY } from './themes';

const sampleConfig = {
  default_dimension: 'general',
  match_threshold: 0.65,
  matcher_backend: 'embedding',
  embedding_model: 'tfidf',
  llm_mode: 'online',
  llm_model: null,
  llm_api_base: null,
  top_k: 5,
  llm_api_key_set: false,
};

const jsonResponse = (data: unknown) =>
  Promise.resolve(
    new Response(JSON.stringify(data), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }),
  );

describe('App theme integration', () => {
  beforeEach(() => {
    vi.stubGlobal('__API_BASE_URL__', '');
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL) => {
        const url = typeof input === 'string' ? input : input.toString();
        if (url.includes('/api/config')) {
          return jsonResponse(sampleConfig);
        }
        if (url.includes('/api/reference/canonical')) {
          return jsonResponse([]);
        }
        if (url.includes('/api/reference/dimensions')) {
          return jsonResponse([]);
        }
        if (url.includes('/api/source/connections')) {
          return jsonResponse([]);
        }
        return jsonResponse({});
      }),
    );
    window.localStorage.clear();
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
    document.body.className = '';
    // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
    delete (document.body as HTMLElement & { dataset: DOMStringMap }).dataset.bsTheme;
  });

  it('applies a stored theme preference on initial render', async () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, 'midnight');

    render(<App />);

    await waitFor(() => expect(document.body).toHaveClass('theme-midnight'));
  });

  it('updates the body class and storage when the user switches themes', async () => {
    render(<App />);

    const select = await screen.findByLabelText('Select UI theme');

    expect(document.body).toHaveClass('theme-dark');

    fireEvent.change(select, { target: { value: 'light' } });

    await waitFor(() => expect(document.body).toHaveClass('theme-light'));
    expect(document.body).not.toHaveClass('theme-dark');
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe('light');
  });
});
