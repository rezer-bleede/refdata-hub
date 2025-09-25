import { PaletteMode, ThemeOptions } from '@mui/material';

export type ThemeChoice = 'dark' | 'warm' | 'cool' | 'lively';

interface ThemeDefinition {
  label: string;
  paletteMode: PaletteMode;
  options: ThemeOptions;
}

export const themeDefinitions: Record<ThemeChoice, ThemeDefinition> = {
  dark: {
    label: 'Dark',
    paletteMode: 'dark',
    options: {
      palette: {
        mode: 'dark',
        primary: { main: '#90caf9' },
        secondary: { main: '#f48fb1' },
        background: {
          default: '#0f172a',
          paper: '#111c34',
        },
      },
      shape: { borderRadius: 12 },
      typography: {
        fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
      },
    },
  },
  warm: {
    label: 'Warm',
    paletteMode: 'light',
    options: {
      palette: {
        mode: 'light',
        primary: { main: '#b23a48' },
        secondary: { main: '#f59f80' },
        background: {
          default: '#fff7ed',
          paper: '#fff1e6',
        },
        text: {
          primary: '#432818',
          secondary: '#7f5539',
        },
      },
      shape: { borderRadius: 14 },
      typography: {
        fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
      },
    },
  },
  cool: {
    label: 'Cool',
    paletteMode: 'light',
    options: {
      palette: {
        mode: 'light',
        primary: { main: '#1b4b8c' },
        secondary: { main: '#58a6ff' },
        background: {
          default: '#eef4ff',
          paper: '#f7faff',
        },
        text: {
          primary: '#0b1a33',
          secondary: '#3f4c67',
        },
      },
      shape: { borderRadius: 14 },
      typography: {
        fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
      },
    },
  },
  lively: {
    label: 'Lively',
    paletteMode: 'light',
    options: {
      palette: {
        mode: 'light',
        primary: { main: '#7c3aed' },
        secondary: { main: '#f97316' },
        background: {
          default: '#fdf4ff',
          paper: '#ffffff',
        },
        success: { main: '#16a34a' },
        warning: { main: '#facc15' },
      },
      shape: { borderRadius: 16 },
      typography: {
        fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
      },
    },
  },
};

export const themeOrder: ThemeChoice[] = ['dark', 'warm', 'cool', 'lively'];
