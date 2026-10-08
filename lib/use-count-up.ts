"use client";

import { useEffect, useRef, useState } from "react";
import { prefersReducedMotion } from "@/lib/motion";

/** A number that glides to its new value instead of jumping. Starts from 0 on
 * first mount, so a figure "counts up" when the screen opens, and from
 * wherever it currently is when the target changes mid-flight. */
export function useCountUp(target: number, duration = 700): number {
  const [value, setValue] = useState(0);
  const shown = useRef(0);

  useEffect(() => {
    if (prefersReducedMotion()) {
      shown.current = target;
      setValue(target);
      return;
    }
    const from = shown.current;
    if (from === target) return;
    const start = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3); // easeOutCubic
      const v = p >= 1 ? target : Math.round(from + (target - from) * eased);
      shown.current = v;
      setValue(v);
      if (p < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, duration]);

  return value;
}
