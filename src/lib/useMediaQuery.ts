import { useEffect, useState } from "react";

/**
 * SSR-safe matchMedia hook. Returns `false` during SSR and on the first client
 * render; updates on mount and whenever the query result changes.
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) {
      return undefined;
    }

    const list = window.matchMedia(query);
    setMatches(list.matches);

    const onChange = (event: MediaQueryListEvent) => {
      setMatches(event.matches);
    };

    list.addEventListener("change", onChange);
    return () => {
      list.removeEventListener("change", onChange);
    };
  }, [query]);

  return matches;
}
