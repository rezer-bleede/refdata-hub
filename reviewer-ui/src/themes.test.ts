import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  THEME_STORAGE_KEY,
  applyTheme,
  persistTheme,
  resolveInitialTheme,
  resolveTheme,
  themeDefinitions,
  themeOrder,
  type ThemeChoice,
} from './themes';

describe('theme utilities', () => {
  beforeEach(() => {
    document.documentElement.className = '';
    document.documentElement.removeAttribute('data-theme');
    window.localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('applies the correct data-theme attribute and dark class', () => {
    applyTheme('light');

    expect(document.documentElement).toHaveAttribute('data-theme', 'light');
    expect(document.documentElement.classList.contains('dark')).toBe(false);

    applyTheme('midnight-marina');
    expect(document.documentElement).toHaveAttribute('data-theme', 'midnight-marina');
    expect(document.documentElement.classList.contains('dark')).toBe(true);

    applyTheme('light');
    expect(document.documentElement.classList.contains('dark')).toBe(false);
  });

  it('keeps legacy RefData palettes available as additional options', () => {
    for (const legacy of ['classic-dark', 'classic-light', 'midnight'] as ThemeChoice[]) {
      expect(themeDefinitions[legacy]).toBeDefined();
      expect(themeOrder).toContain(legacy);
    }

    applyTheme('midnight');
    expect(document.documentElement).toHaveAttribute('data-theme', 'midnight');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });

  it('updates the meta theme-color when the palette changes', () => {
    const meta = document.createElement('meta');
    meta.setAttribute('name', 'theme-color');
    document.head.appendChild(meta);

    applyTheme('burj-gold');
    expect(meta.getAttribute('content')).toBe('#d4af37');

    document.head.removeChild(meta);
  });

  it('persists the selected theme in local storage', () => {
    persistTheme('oasis');

    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe('oasis');
  });

  it('restores the stored theme when available', () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, 'midnight');

    expect(resolveInitialTheme()).toBe('midnight');
  });

  it('defaults to the light palette when nothing is stored', () => {
    expect(resolveInitialTheme()).toBe<ThemeChoice>('light');
  });

  it('ignores unknown stored values and falls back to the provided default', () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, 'not-a-theme');

    expect(resolveInitialTheme('harbour-blue')).toBe<ThemeChoice>('harbour-blue');
  });

  it('resolves the system choice from the preferred color scheme', () => {
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

    vi.stubGlobal('matchMedia', matchMediaMock as unknown as typeof window.matchMedia);

    expect(resolveTheme('system')).toEqual({ resolvedId: 'dark', mode: 'dark' });

    matchMediaMock.mockReturnValue({
      matches: false,
      media: '',
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    } as unknown as MediaQueryList);

    expect(resolveTheme('system')).toEqual({ resolvedId: 'light', mode: 'light' });
  });
});
