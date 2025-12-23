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
  fetchDimensions,
} from '../api';
import type { CanonicalValue, DimensionDefinition, SystemConfig } from '../types';

interface AppStateValue {
  config: SystemConfig | null;
  canonicalValues: CanonicalValue[];
  dimensions: DimensionDefinition[];
  isLoading: boolean;
  loadError: string | null;
  refreshToken: number;
  refresh: () => Promise<boolean>;
  setConfig: (updater: SystemConfig | null | ((prev: SystemConfig | null) => SystemConfig | null)) => void;
  updateCanonicalValues: (
    updater: CanonicalValue[] | ((prev: CanonicalValue[]) => CanonicalValue[]),
  ) => void;
  updateDimensions: (
    updater: DimensionDefinition[] | ((prev: DimensionDefinition[]) => DimensionDefinition[]),
  ) => void;
}

const AppStateContext = createContext<AppStateValue | undefined>(undefined);

function sortCanonical(values: CanonicalValue[]): CanonicalValue[] {
  return [...values].sort((a, b) => a.canonical_label.localeCompare(b.canonical_label));
}

function sortDimensions(values: DimensionDefinition[]): DimensionDefinition[] {
  return [...values].sort((a, b) => a.label.localeCompare(b.label));
}

export const AppStateProvider = ({ children }: PropsWithChildren) => {
  const [config, setConfig] = useState<SystemConfig | null>(null);
  const [canonicalValues, setCanonicalValues] = useState<CanonicalValue[]>([]);
  const [dimensions, setDimensions] = useState<DimensionDefinition[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState(0);

  const refresh = useCallback(async (): Promise<boolean> => {
    setIsLoading(true);
    setLoadError(null);
    const [configResult, canonicalResult, dimensionResult] = await Promise.allSettled([
      fetchConfig(),
      fetchCanonicalValues(),
      fetchDimensions(),
    ]);

    const errors: string[] = [];
    console.debug('App state refresh completed', {
      configStatus: configResult.status,
      canonicalStatus: canonicalResult.status,
      dimensionStatus: dimensionResult.status,
    });

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

    if (dimensionResult.status === 'fulfilled') {
      setDimensions(sortDimensions(dimensionResult.value));
    } else {
      console.error('Failed to load dimensions', dimensionResult.reason);
      errors.push('dimension registry');
    }

    setIsLoading(false);
    setRefreshToken((value) => value + 1);

    if (errors.length) {
      const joined = errors.length === 2 ? errors.join(' and ') : errors[0];
      const message = `Unable to load ${joined} from the API. Confirm the backend service is running.`;
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
      dimensions,
      isLoading,
      loadError,
      refreshToken,
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
      updateDimensions: (updater) => {
        setDimensions((prev) => {
          const next =
            typeof updater === 'function'
              ? (updater as (values: DimensionDefinition[]) => DimensionDefinition[])(prev)
              : updater;
          return sortDimensions(next);
        });
      },
    }),
    [canonicalValues, config, dimensions, isLoading, loadError, refresh, refreshToken],
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
