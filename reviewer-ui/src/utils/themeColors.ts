import { useEffect, useState } from 'react';

export interface ChartTokenSet {
  chart1: string;
  chart2: string;
  chart3: string;
  chart4: string;
  chart5: string;
  chart6: string;
  chart7: string;
  chart8: string;
  grid: string;
  axis: string;
  tooltipBg: string;
  brandPrimary: string;
  brandSecondary: string;
  brandSuccess: string;
  widgetBg: string;
  textTertiary: string;
}

const FALLBACK: ChartTokenSet = {
  chart1: '#4f46e5',
  chart2: '#0284c7',
  chart3: '#059669',
  chart4: '#d97706',
  chart5: '#dc2626',
  chart6: '#9333ea',
  chart7: '#db2777',
  chart8: '#0891b2',
  grid: '#e2e8f0',
  axis: '#64748b',
  tooltipBg: '#ffffff',
  brandPrimary: '#4f46e5',
  brandSecondary: '#8b5cf6',
  brandSuccess: '#10b981',
  widgetBg: '#ffffff',
  textTertiary: '#64748b',
};

function readVar(name: string, fallback: string): string {
  if (typeof document === 'undefined') {
    return fallback;
  }
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return value || fallback;
}

export function readChartTokens(): ChartTokenSet {
  return {
    chart1: readVar('--chart-1', FALLBACK.chart1),
    chart2: readVar('--chart-2', FALLBACK.chart2),
    chart3: readVar('--chart-3', FALLBACK.chart3),
    chart4: readVar('--chart-4', FALLBACK.chart4),
    chart5: readVar('--chart-5', FALLBACK.chart5),
    chart6: readVar('--chart-6', FALLBACK.chart6),
    chart7: readVar('--chart-7', FALLBACK.chart7),
    chart8: readVar('--chart-8', FALLBACK.chart8),
    grid: readVar('--chart-grid', FALLBACK.grid),
    axis: readVar('--chart-axis', FALLBACK.axis),
    tooltipBg: readVar('--chart-tooltip-bg', FALLBACK.tooltipBg),
    brandPrimary: readVar('--color-brand-primary', FALLBACK.brandPrimary),
    brandSecondary: readVar('--color-brand-secondary', FALLBACK.brandSecondary),
    brandSuccess: readVar('--color-brand-success', FALLBACK.brandSuccess),
    widgetBg: readVar('--color-widget-bg', FALLBACK.widgetBg),
    textTertiary: readVar('--color-text-tertiary', FALLBACK.textTertiary),
  };
}

/**
 * Returns a counter that increments whenever the active palette changes
 * (data-theme / .dark on <html>), letting visuals rebuild from tokens.
 */
export function useThemeVersion(): number {
  const [version, setVersion] = useState(0);

  useEffect(() => {
    if (typeof document === 'undefined') {
      return;
    }

    const bump = () => setVersion((value) => value + 1);
    const observer = new MutationObserver(bump);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme', 'class'],
    });

    let mediaQuery: MediaQueryList | undefined;
    if (typeof window.matchMedia === 'function') {
      mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      mediaQuery.addEventListener?.('change', bump);
    }

    return () => {
      observer.disconnect();
      mediaQuery?.removeEventListener?.('change', bump);
    };
  }, []);

  return version;
}

export { FALLBACK as FALLBACK_CHART_TOKENS };
