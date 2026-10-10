import '@testing-library/jest-dom/vitest';

// jsdom can surface window.localStorage as a bare object without Storage
// methods (seen with jsdom 27 on Node 25). Provide a minimal in-memory
// implementation so theme persistence behaves consistently in tests.
if (
  typeof window !== 'undefined' &&
  (typeof window.localStorage === 'undefined' ||
    typeof (window.localStorage as Storage | undefined)?.clear !== 'function')
) {
  const createStore = (): Storage => {
    const data = new Map<string, string>();
    return {
      get length() {
        return data.size;
      },
      clear: () => data.clear(),
      getItem: (key: string) => (data.has(key) ? (data.get(key) as string) : null),
      key: (index: number) => Array.from(data.keys())[index] ?? null,
      removeItem: (key: string) => {
        data.delete(key);
      },
      setItem: (key: string, value: string) => {
        data.set(key, String(value));
      },
    } satisfies Storage;
  };

  const store = createStore();
  Object.defineProperty(window, 'localStorage', {
    value: store,
    configurable: true,
    writable: true,
  });
  Object.defineProperty(globalThis, 'localStorage', {
    value: store,
    configurable: true,
    writable: true,
  });
}
