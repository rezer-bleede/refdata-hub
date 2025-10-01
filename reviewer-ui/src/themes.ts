export type ThemeChoice = 'dark' | 'light' | 'midnight';

interface ThemeDefinition {
  label: string;
  dataTheme: 'dark' | 'light';
  bodyClass?: string;
}

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
