"use client";

import { useLayoutEffect, useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import { prefersReducedMotion } from "@/lib/motion";

const DURATION_MS = 340;

/**
 * Smoothly opens and closes a block of any height.
 *
 * Animating `height` needs real pixel numbers, so on each change this
 * measures where it is and where it's going, animates between the two, and
 * hands back to `height: auto` at the end so the content can keep resizing
 * on its own afterwards. (CSS-only tricks like animating grid rows don't
 * work in the older Safari this app targets.) Closed content is
 * `visibility: hidden`, so nothing inside stays focusable.
 */
export function Collapse({
  open,
  children,
  className = "",
}: {
  open: boolean;
  children: ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const first = useRef(true);
  // The element's style is owned by the effect below. React must never
  // re-apply it, so the initial value is frozen in state (same object every
  // render = React sees no change and leaves the DOM alone).
  const [initialStyle] = useState<CSSProperties>(() => ({
    height: open ? "auto" : 0,
    opacity: open ? 1 : 0,
    visibility: open ? "visible" : "hidden",
    overflow: "hidden",
  }));

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;

    const settle = () => {
      el.style.transition = "";
      el.style.height = open ? "auto" : "0px";
      el.style.opacity = open ? "1" : "0";
      el.style.visibility = open ? "visible" : "hidden";
    };

    if (first.current) {
      first.current = false;
      settle();
      return;
    }
    if (prefersReducedMotion()) {
      settle();
      return;
    }

    const from = el.getBoundingClientRect().height;
    el.style.visibility = "visible";
    const to = open ? el.scrollHeight : 0;
    if (Math.abs(from - to) < 1) {
      settle();
      return;
    }

    el.style.transition = "none";
    el.style.height = `${from}px`;
    void el.offsetHeight; // commit the starting height before animating away from it
    el.style.transition = `height ${DURATION_MS}ms cubic-bezier(0.22,1,0.36,1), opacity ${DURATION_MS - 80}ms ease`;
    el.style.height = `${to}px`;
    el.style.opacity = open ? "1" : "0";

    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      el.removeEventListener("transitionend", onEnd);
      window.clearTimeout(timer);
      settle();
    };
    const onEnd = (e: TransitionEvent) => {
      if (e.target === el && e.propertyName === "height") finish();
    };
    el.addEventListener("transitionend", onEnd);
    // transitionend is skipped if the element gets hidden mid-flight; don't depend on it.
    const timer = window.setTimeout(finish, DURATION_MS + 150);

    return () => {
      done = true;
      el.removeEventListener("transitionend", onEnd);
      window.clearTimeout(timer);
    };
  }, [open]);

  return (
    <div ref={ref} style={initialStyle} aria-hidden={!open} className={className}>
      {children}
    </div>
  );
}
