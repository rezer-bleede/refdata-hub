import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AppScaffold } from './App';
import type { ThemeChoice } from './themes';

const refreshMock = vi.fn<[], Promise<boolean>>();
let mockIsLoading = false;
let mockLoadError: string | null = null;

vi.mock('./state/AppStateContext', () => ({
  useAppState: () => ({
    config: { matcher_backend: 'embedding' },
    canonicalValues: [],
    isLoading: mockIsLoading,
    loadError: mockLoadError,
    refresh: refreshMock,
  }),
}));

const createProps = () => ({
  themeChoice: 'dark' as ThemeChoice,
  onThemeChange: vi.fn<(choice: ThemeChoice) => void>(),
  toast: null,
  toastKey: 0,
  onToast: vi.fn(),
  onCloseToast: vi.fn(),
});

describe('AppScaffold layout', () => {
  beforeEach(() => {
    mockIsLoading = false;
    mockLoadError = null;
    refreshMock.mockResolvedValue(true);
    const sampleConfig = {
      default_dimension: 'general',
      match_threshold: 0.65,
      matcher_backend: 'embedding',
      embedding_model: 'tfidf',
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
        if (url.includes('/api/source/connections')) {
          return jsonResponse([]);
        }
        return jsonResponse({});
      }),
    );
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  it('renders navigation items and highlights the active route', () => {
    const props = createProps();
    render(
      <MemoryRouter initialEntries={["/connections"]}>
        <AppScaffold {...props} />
      </MemoryRouter>,
    );

    expect(screen.getByRole('link', { name: 'Source Connections' })).toHaveClass('active');
    expect(screen.getByRole('heading', { name: 'Source Connections' })).toBeInTheDocument();
  });

  it('invokes the refresh workflow and surfaces success toasts', async () => {
    const props = createProps();
    render(
      <MemoryRouter>
        <AppScaffold {...props} />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Sync data' }));

    await waitFor(() => expect(refreshMock).toHaveBeenCalledTimes(1));
    expect(props.onToast).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'success', content: 'Synchronized with backend.' }),
    );
  });

  it('announces refresh failures via toast notifications', async () => {
    refreshMock.mockResolvedValueOnce(false);
    const props = createProps();
    render(
      <MemoryRouter>
        <AppScaffold {...props} />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Sync data' }));

    await waitFor(() => expect(refreshMock).toHaveBeenCalledTimes(1));
    expect(props.onToast).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'error', content: 'Unable to refresh all resources.' }),
    );
  });

  it('bubbles initial load errors through the toast handler', async () => {
    mockLoadError = 'Unable to load configuration';
    const props = createProps();
    render(
      <MemoryRouter>
        <AppScaffold {...props} />
      </MemoryRouter>,
    );

    await waitFor(() => expect(props.onToast).toHaveBeenCalledWith({
      type: 'error',
      content: 'Unable to load configuration',
    }));
  });

  it('allows theme changes via the header select control', () => {
    const props = createProps();
    render(
      <MemoryRouter>
        <AppScaffold {...props} />
      </MemoryRouter>,
    );

    fireEvent.change(screen.getByLabelText('Select UI theme'), { target: { value: 'light' } });

    expect(props.onThemeChange).toHaveBeenCalledWith('light');
  });
});
