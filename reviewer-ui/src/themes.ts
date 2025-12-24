export type ThemeChoice = 'dark' | 'light' | 'midnight';

interface ThemeDefinition {
  label: string;
  dataTheme: 'dark' | 'light';
  bodyClass?: string;
}

const THEME_STORAGE_KEY = 'refdata-hub:theme-choice';

export const themeDefinitions: Record<ThemeChoice, ThemeDefinition> = {
  dark: {
    label: 'Dark',
    dataTheme: 'dark',
    bodyClass: 'theme-dark',
  },
  light: {
    label: 'Light',
    dataTheme: 'light',
    bodyClass: 'theme-light',
  },
  midnight: {
    label: 'Midnight',
    dataTheme: 'dark',
    bodyClass: 'theme-midnight',
  },
};

export const themeOrder: ThemeChoice[] = ['dark', 'light', 'midnight'];

export function applyTheme(choice: ThemeChoice): void {
  const definition = themeDefinitions[choice];
  document.body.dataset.bsTheme = definition.dataTheme;

  document.body.classList.remove(
    ...Object.values(themeDefinitions)
      .map((theme) => theme.bodyClass)
      .filter((value): value is string => Boolean(value)),
  );

  if (definition.bodyClass) {
    document.body.classList.add(definition.bodyClass);
  }
}

export function persistTheme(choice: ThemeChoice): void {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, choice);
  } catch (error) {
    console.warn('Unable to persist theme preference', error);
  }
}

export function resolveInitialTheme(fallback: ThemeChoice = 'dark'): ThemeChoice {
  if (typeof window === 'undefined') {
    return fallback;
  }

  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (stored && (stored === 'dark' || stored === 'light' || stored === 'midnight')) {
      return stored;
    }
  } catch (error) {
    console.warn('Unable to read persisted theme preference', error);
  }

  const prefersLight =
    typeof window.matchMedia === 'function' && window.matchMedia('(prefers-color-scheme: light)').matches;

  return prefersLight ? 'light' : fallback;
}

export { THEME_STORAGE_KEY };
