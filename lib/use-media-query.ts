"use client";

import { useSyncExternalStore } from "react";

/** Live `window.matchMedia` result. Reports false on the server and during
 * hydration, then the real answer — callers should only branch on it for UI
 * that appears after the first client render (the dashboard does: it shows a
 * loading skeleton until its data arrives). */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const mql = window.matchMedia(query);
      mql.addEventListener("change", onChange);
      return () => mql.removeEventListener("change", onChange);
    },
    () => window.matchMedia(query).matches,
    () => false
  );
}
