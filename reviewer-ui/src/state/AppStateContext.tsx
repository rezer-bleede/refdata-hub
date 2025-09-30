import {
  createContext,
  PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  fetchCanonicalValues,
  fetchConfig,
} from '../api';
import type { CanonicalValue, SystemConfig } from '../types';

interface AppStateValue {
  config: SystemConfig | null;
  canonicalValues: CanonicalValue[];
  isLoading: boolean;
  loadError: string | null;
  refresh: () => Promise<boolean>;
  setConfig: (updater: SystemConfig | null | ((prev: SystemConfig | null) => SystemConfig | null)) => void;
  updateCanonicalValues: (
    updater: CanonicalValue[] | ((prev: CanonicalValue[]) => CanonicalValue[]),
  ) => void;
}

const AppStateContext = createContext<AppStateValue | undefined>(undefined);

function sortCanonical(values: CanonicalValue[]): CanonicalValue[] {
  return [...values].sort((a, b) => a.canonical_label.localeCompare(b.canonical_label));
}

export const AppStateProvider = ({ children }: PropsWithChildren) => {
  const [config, setConfig] = useState<SystemConfig | null>(null);
  const [canonicalValues, setCanonicalValues] = useState<CanonicalValue[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const refresh = useCallback(async (): Promise<boolean> => {
    setIsLoading(true);
    setLoadError(null);
    const [configResult, canonicalResult] = await Promise.allSettled([
      fetchConfig(),
      fetchCanonicalValues(),
    ]);

    const errors: string[] = [];

    if (configResult.status === 'fulfilled') {
      setConfig(configResult.value);
    } else {
      console.error('Failed to load configuration', configResult.reason);
      errors.push('configuration');
    }

    if (canonicalResult.status === 'fulfilled') {
      setCanonicalValues(sortCanonical(canonicalResult.value));
    } else {
      console.error('Failed to load canonical values', canonicalResult.reason);
      errors.push('canonical library');
    }

    setIsLoading(false);

    if (errors.length) {
      const message = `Unable to load ${errors.join(' & ')}`;
      setLoadError(message);
      return false;
    }

    return true;
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const value = useMemo<AppStateValue>(
    () => ({
      config,
      canonicalValues,
      isLoading,
      loadError,
      refresh,
      setConfig: (updater) => {
        setConfig((prev) =>
          typeof updater === 'function' ? (updater as (val: SystemConfig | null) => SystemConfig | null)(prev) : updater,
        );
      },
      updateCanonicalValues: (updater) => {
        setCanonicalValues((prev) => {
          const next =
            typeof updater === 'function' ? (updater as (values: CanonicalValue[]) => CanonicalValue[])(prev) : updater;
          return sortCanonical(next);
        });
      },
    }),
    [canonicalValues, config, isLoading, loadError, refresh],
  );

  return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>;
};

export function useAppState(): AppStateValue {
  const context = useContext(AppStateContext);
  if (!context) {
    throw new Error('useAppState must be used within an AppStateProvider');
  }
  return context;
}
