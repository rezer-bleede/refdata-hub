import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ComponentProps } from 'react';

import { AppScaffold, navItems } from './App';
import type { ThemeChoice } from './themes';

type AppScaffoldProps = ComponentProps<typeof AppScaffold>;

const refreshMock = vi.fn<[], Promise<boolean>>();
let mockIsLoading = false;
let mockLoadError: string | null = null;

vi.mock('./state/AppStateContext', () => ({
  useAppState: () => ({
    config: { matcher_backend: 'embedding' },
    canonicalValues: [],
    dimensions: [],
    isLoading: mockIsLoading,
    loadError: mockLoadError,
    refreshToken: 0,
    refresh: refreshMock,
    updateDimensions: vi.fn(),
  }),
}));

const createProps = (): {
  props: AppScaffoldProps;
  mocks: {
    onThemeChange: ReturnType<typeof vi.fn>;
    onToast: ReturnType<typeof vi.fn>;
    onCloseToast: ReturnType<typeof vi.fn>;
  };
} => {
  const onThemeChange = vi.fn();
  const onToast = vi.fn();
  const onCloseToast = vi.fn();

  return {
    props: {
      themeChoice: 'dark' as ThemeChoice,
      onThemeChange: (choice) => onThemeChange(choice),
      toast: null,
      toastKey: 0,
      onToast: (toast) => onToast(toast),
      onCloseToast: () => onCloseToast(),
    },
    mocks: {
      onThemeChange,
      onToast,
      onCloseToast,
    },
  };
};

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
    const { props } = createProps();
    render(
      <MemoryRouter initialEntries={["/connections"]}>
        <AppScaffold {...props} />
      </MemoryRouter>,
    );

    expect(screen.getByRole('link', { name: 'Source Connections' })).toHaveClass('active');
    expect(screen.getByRole('heading', { name: 'Source Connections' })).toBeInTheDocument();
  });

  it('renders the branded logo in the sidebar header', () => {
    const { props } = createProps();
    render(
      <MemoryRouter>
        <AppScaffold {...props} />
      </MemoryRouter>,
    );

    const logoContainer = screen.getByTestId('app-logo-mark');
    const logo = within(logoContainer).getByRole('img', { name: 'RefData Hub logo' });

    expect(logoContainer).toBeVisible();
    expect(logo.tagName.toLowerCase()).toBe('svg');
    expect(logo).toHaveAttribute('viewBox', '0 0 64 64');
  });

  it('invokes the refresh workflow and surfaces success toasts', async () => {
    const { props, mocks } = createProps();
    render(
      <MemoryRouter>
        <AppScaffold {...props} />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Sync data' }));

    await waitFor(() => expect(refreshMock).toHaveBeenCalledTimes(1));
    expect(mocks.onToast).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'success', content: 'Synchronized with backend.' }),
    );
  });

  it('announces refresh failures via toast notifications', async () => {
    refreshMock.mockResolvedValueOnce(false);
    const { props, mocks } = createProps();
    render(
      <MemoryRouter>
        <AppScaffold {...props} />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Sync data' }));

    await waitFor(() => expect(refreshMock).toHaveBeenCalledTimes(1));
    expect(mocks.onToast).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'error', content: 'Unable to refresh all resources.' }),
    );
  });

  it('bubbles initial load errors through the toast handler', async () => {
    mockLoadError = 'Unable to load configuration';
    const { props, mocks } = createProps();
    render(
      <MemoryRouter>
        <AppScaffold {...props} />
      </MemoryRouter>,
    );

    await waitFor(() => expect(mocks.onToast).toHaveBeenCalledWith({
      type: 'error',
      content: 'Unable to load configuration',
    }));
  });

  it('allows theme changes via the header select control', () => {
    const { props, mocks } = createProps();
    render(
      <MemoryRouter>
        <AppScaffold {...props} />
      </MemoryRouter>,
    );

    fireEvent.change(screen.getByLabelText('Select UI theme'), { target: { value: 'light' } });

    expect(mocks.onThemeChange).toHaveBeenCalledWith('light');
  });

  it('supports collapsing and expanding the primary navigation', () => {
    const { props } = createProps();
    render(
      <MemoryRouter>
        <AppScaffold {...props} />
      </MemoryRouter>,
    );

    const sidebar = screen.getByLabelText('Primary navigation');
    const collapseToggle = screen.getByLabelText('Collapse navigation menu');

    expect(sidebar).not.toHaveClass('is-collapsed');
    fireEvent.click(collapseToggle);
    expect(sidebar).toHaveClass('is-collapsed');
    expect(collapseToggle).toHaveAttribute('aria-expanded', 'false');

    const expandToggle = screen.getByLabelText('Expand navigation menu');
    fireEvent.click(expandToggle);
    expect(sidebar).not.toHaveClass('is-collapsed');
  });

  it('keeps the collapse toggle aligned with the brand row', () => {
    const { props } = createProps();
    render(
      <MemoryRouter>
        <AppScaffold {...props} />
      </MemoryRouter>,
    );

    const brandLink = screen.getByRole('link', { name: /RefData Hub/ });
    const collapseToggle = screen.getByRole('button', { name: 'Collapse navigation menu' });
    const topRow = brandLink.parentElement;

    expect(topRow).not.toBeNull();
    expect(topRow).toHaveClass('app-sidebar__top');
    expect(collapseToggle.parentElement).toBe(topRow);
  });

  it('shows descriptive navigation icons when collapsed', () => {
    const { props } = createProps();
    render(
      <MemoryRouter>
        <AppScaffold {...props} />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByLabelText('Collapse navigation menu'));

    const icons = screen.getAllByTestId(/nav-icon-/);
    expect(icons).toHaveLength(navItems.length);
    icons.forEach((icon) => expect(icon).toBeVisible());
  });
});
