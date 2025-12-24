import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { THEME_STORAGE_KEY, applyTheme, persistTheme, resolveInitialTheme, type ThemeChoice } from './themes';

describe('theme utilities', () => {
  beforeEach(() => {
    document.body.className = '';
    // Vitest keeps dataset properties as strings; ensure a clean slate.
    // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
    delete (document.body as HTMLElement & { dataset: DOMStringMap }).dataset.bsTheme;
    window.localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('applies the correct body class and bootstrap theme data attribute', () => {
    applyTheme('light');

    expect(document.body.dataset.bsTheme).toBe('light');
    expect(document.body).toHaveClass('theme-light');

    applyTheme('midnight');
    expect(document.body.dataset.bsTheme).toBe('dark');
    expect(document.body).toHaveClass('theme-midnight');
    expect(document.body).not.toHaveClass('theme-light');
  });

  it('persists the selected theme in local storage', () => {
    persistTheme('light');

    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe('light');
  });

  it('restores the stored theme when available', () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, 'midnight');

    expect(resolveInitialTheme('dark')).toBe('midnight');
  });

  it('uses the preferred color scheme when no stored theme is present', () => {
    const matchMediaMock = vi.fn().mockReturnValue({
      matches: true,
      media: '',
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    } satisfies MediaQueryList);

    const originalMatchMedia = window.matchMedia;
    vi.stubGlobal('matchMedia', matchMediaMock as unknown as typeof originalMatchMedia);

    expect(resolveInitialTheme('dark')).toBe<'light'>('light');
  });

  it('falls back to the provided default when storage and media queries are unavailable', () => {
    vi.stubGlobal('matchMedia', undefined);

    expect(resolveInitialTheme('dark')).toBe<ThemeChoice>('dark');
  });
});
