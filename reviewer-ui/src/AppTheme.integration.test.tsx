import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import App from './App';
import { THEME_STORAGE_KEY } from './themes';

const sampleConfig = {
  default_dimension: 'general',
  match_threshold: 0.65,
  matcher_backend: 'embedding',
  embedding_model: 'BAAI/bge-small-en-v1.5',
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
    document.documentElement.className = '';
    document.documentElement.removeAttribute('data-theme');
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
    document.documentElement.className = '';
    document.documentElement.removeAttribute('data-theme');
  });

  it('applies a stored theme preference on initial render', async () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, 'midnight');

    render(<App />);

    await waitFor(() =>
      expect(document.documentElement).toHaveAttribute('data-theme', 'midnight'),
    );
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });

  it('starts with the light palette when no preference is stored', async () => {
    render(<App />);

    await waitFor(() =>
      expect(document.documentElement).toHaveAttribute('data-theme', 'light'),
    );
    expect(document.documentElement.classList.contains('dark')).toBe(false);
  });

  it('updates the document palette and storage when the user switches themes', async () => {
    render(<App />);

    await waitFor(() =>
      expect(document.documentElement).toHaveAttribute('data-theme', 'light'),
    );

    fireEvent.click(screen.getByRole('button', { name: /Select UI theme/ }));

    const dialog = await screen.findByRole('dialog', { name: 'Theme options' });
    const option = within(dialog).getByRole('radio', { name: /Harbour Blue/ });
    fireEvent.click(option);

    await waitFor(() =>
      expect(document.documentElement).toHaveAttribute('data-theme', 'harbour-blue'),
    );
    expect(document.documentElement.classList.contains('dark')).toBe(false);
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe('harbour-blue');
  });

  it('supports switching to a dark palette through the theme picker', async () => {
    render(<App />);

    fireEvent.click(screen.getByRole('button', { name: /Select UI theme/ }));
    const dialog = await screen.findByRole('dialog', { name: 'Theme options' });
    fireEvent.click(within(dialog).getByRole('radio', { name: /Midnight Marina/ }));

    await waitFor(() =>
      expect(document.documentElement).toHaveAttribute('data-theme', 'midnight-marina'),
    );
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });
});
