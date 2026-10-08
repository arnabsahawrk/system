"use client";

import { useEffect, useState } from "react";

/** False for the first painted frame, true right after. Lets a bar or ring
 * render at 0 and then be set to its real value, so the CSS transition has a
 * "before" to animate from (a bare rAF can land in the same frame as the
 * first commit and the browser would never see the 0). */
export function useArmed(): boolean {
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    let outer = 0;
    let inner = 0;
    outer = requestAnimationFrame(() => {
      inner = requestAnimationFrame(() => setArmed(true));
    });
    return () => {
      cancelAnimationFrame(outer);
      cancelAnimationFrame(inner);
    };
  }, []);
  return armed;
}
