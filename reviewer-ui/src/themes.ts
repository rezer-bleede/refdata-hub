export type ThemeChoice =
  | 'system'
  | 'light'
  | 'dark'
  | 'midnight-marina'
  | 'burj-gold'
  | 'desert-dusk'
  | 'oasis'
  | 'aurora'
  | 'coral-reef'
  | 'harbour-blue'
  | 'classic-dark'
  | 'classic-light'
  | 'midnight';

export type ResolvedTheme = Exclude<ThemeChoice, 'system'>;

export type ThemeMode = 'light' | 'dark';

export interface ThemeConfig {
  id: ThemeChoice;
  name: string;
  mode: ThemeMode | 'auto';
  description: string;
  swatch: {
    bg: string;
    surface: string;
    accent: string;
  };
}

const THEME_STORAGE_KEY = 'refdata-hub:theme-choice';

export const DARK_THEME_IDS: ResolvedTheme[] = [
  'dark',
  'midnight-marina',
  'burj-gold',
  'aurora',
  'classic-dark',
  'midnight',
];

export const themeDefinitions: Record<ThemeChoice, ThemeConfig> = {
  system: {
    id: 'system',
    name: 'System',
    mode: 'auto',
    description: 'Follows OS preference (Light or Dark)',
    swatch: { bg: '#f8fafc', surface: '#ffffff', accent: '#4f46e5' },
  },
  light: {
    id: 'light',
    name: 'Light',
    mode: 'light',
    description: 'Clean, crisp light dashboard theme',
    swatch: { bg: '#f8fafc', surface: '#ffffff', accent: '#4f46e5' },
  },
  dark: {
    id: 'dark',
    name: 'Dark',
    mode: 'dark',
    description: 'Classic dark mode for low-light environments',
    swatch: { bg: '#0b0f19', surface: '#111827', accent: '#6366f1' },
  },
  'midnight-marina': {
    id: 'midnight-marina',
    name: 'Midnight Marina',
    mode: 'dark',
    description: 'Deep navy base with electric cyan & teal accents',
    swatch: { bg: '#030712', surface: '#0b1329', accent: '#06b6d4' },
  },
  'burj-gold': {
    id: 'burj-gold',
    name: 'Burj Gold',
    mode: 'dark',
    description: 'Near-black base with luxury champagne gold accents',
    swatch: { bg: '#0b0b0d', surface: '#141417', accent: '#d4af37' },
  },
  'desert-dusk': {
    id: 'desert-dusk',
    name: 'Desert Dusk',
    mode: 'light',
    description: 'Warm sand base with terracotta & amber sunset tones',
    swatch: { bg: '#faf6f0', surface: '#fffdfa', accent: '#c85a32' },
  },
  oasis: {
    id: 'oasis',
    name: 'Oasis',
    mode: 'light',
    description: 'Fresh off-white base with emerald & mint accents',
    swatch: { bg: '#f4f8f6', surface: '#ffffff', accent: '#059669' },
  },
  aurora: {
    id: 'aurora',
    name: 'Aurora',
    mode: 'dark',
    description: 'Deep violet base with vibrant magenta & cyan gradients',
    swatch: { bg: '#090714', surface: '#120e24', accent: '#d946ef' },
  },
  'coral-reef': {
    id: 'coral-reef',
    name: 'Coral Reef',
    mode: 'light',
    description: 'Bright airy base with coral & turquoise accents',
    swatch: { bg: '#f7fafc', surface: '#ffffff', accent: '#ff6b6b' },
  },
  'harbour-blue': {
    id: 'harbour-blue',
    name: 'Harbour Blue',
    mode: 'light',
    description: 'Zoho CRM Day mode — Honolulu-blue actions, hairline borders, four-brand chart palette',
    swatch: { bg: '#f5f7fa', surface: '#ffffff', accent: '#226db4' },
  },
  'classic-dark': {
    id: 'classic-dark',
    name: 'Classic Dark',
    mode: 'dark',
    description: 'Original RefData Hub aurora-on-abyss palette',
    swatch: { bg: '#020617', surface: '#0f172a', accent: '#6366f1' },
  },
  'classic-light': {
    id: 'classic-light',
    name: 'Classic Light',
    mode: 'light',
    description: 'Original RefData Hub light workspace palette',
    swatch: { bg: '#f8fafc', surface: '#ffffff', accent: '#6366f1' },
  },
  midnight: {
    id: 'midnight',
    name: 'Midnight',
    mode: 'dark',
    description: 'Original RefData Hub deep indigo midnight palette',
    swatch: { bg: '#0b1224', surface: '#111827', accent: '#818cf8' },
  },
};

export const themeOrder: ThemeChoice[] = Object.keys(themeDefinitions) as ThemeChoice[];

const isThemeChoice = (value: string | null): value is ThemeChoice =>
  Boolean(value && value in themeDefinitions);

export function getSystemThemeMode(): ThemeMode {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return 'light';
  }
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function resolveTheme(choice: ThemeChoice): { resolvedId: ResolvedTheme; mode: ThemeMode } {
  if (choice === 'system') {
    const sysMode = getSystemThemeMode();
    return { resolvedId: sysMode, mode: sysMode };
  }
  const found = themeDefinitions[choice];
  const mode: ThemeMode = found?.mode === 'dark' ? 'dark' : 'light';
  return { resolvedId: choice, mode };
}

function updateMetaThemeColor(accentColor: string): void {
  if (typeof document === 'undefined') {
    return;
  }
  const metaThemeColor = document.querySelector('meta[name="theme-color"]');
  if (metaThemeColor) {
    metaThemeColor.setAttribute('content', accentColor);
  }
}

export function applyTheme(choice: ThemeChoice): void {
  if (typeof document === 'undefined') {
    return;
  }

  const { resolvedId, mode } = resolveTheme(choice);
  const root = document.documentElement;
  root.setAttribute('data-theme', resolvedId);
  root.classList.toggle('dark', mode === 'dark');

  const found = themeDefinitions[resolvedId];
  if (found) {
    updateMetaThemeColor(found.swatch.accent);
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

export function resolveInitialTheme(fallback: ThemeChoice = 'light'): ThemeChoice {
  if (typeof window === 'undefined') {
    return fallback;
  }

  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (isThemeChoice(stored)) {
      return stored;
    }
  } catch (error) {
    console.warn('Unable to read persisted theme preference', error);
  }

  return fallback;
}

export { THEME_STORAGE_KEY };
