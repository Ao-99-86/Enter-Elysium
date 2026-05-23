import { useCallback, useEffect, useRef, useState } from "react";

/**
 * SSR-safe persisted state. Initial render returns the provided default; on mount
 * the stored value (if any) is hydrated.
 */
export function useLocalStorageState<T>(
  key: string,
  initial: T
): [T, (next: T | ((current: T) => T)) => void] {
  const [value, setValue] = useState<T>(initial);
  const hydratedRef = useRef(false);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    try {
      const stored = window.localStorage.getItem(key);
      if (stored !== null) {
        setValue(JSON.parse(stored) as T);
      }
    } catch {
      // Ignore corrupted entries; fall back to the default.
    } finally {
      hydratedRef.current = true;
    }
  }, [key]);

  useEffect(() => {
    if (typeof window === "undefined" || !hydratedRef.current) {
      return;
    }

    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // Quota or private-mode failure — silently skip.
    }
  }, [key, value]);

  const update = useCallback((next: T | ((current: T) => T)) => {
    setValue((current) =>
      typeof next === "function" ? (next as (current: T) => T)(current) : next
    );
  }, []);

  return [value, update];
}
