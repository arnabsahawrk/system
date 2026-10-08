"use client";

import { useEffect, useState } from "react";

/**
 * One task: a real checkbox (keyboard, screen reader and the whole row as a
 * 44px tap target all keep working) wearing a drawn box. Ticking strokes the
 * check mark in, pops the box and sweeps a strike-through across the name;
 * the styles live in app/globals.css.
 */
export function TaskRow({
  name,
  completed,
  locked,
  chain,
  onToggle,
}: {
  name: string;
  completed: boolean;
  /** Not today's card: shown, but can't be changed. */
  locked: boolean;
  /** Consecutive scheduled occurrences done, including today's if it's ticked. */
  chain: number;
  onToggle: (next: boolean, row: HTMLElement) => void;
}) {
  const [popping, setPopping] = useState(false);
  // The chain badge bumps when its number changes, but not when the card
  // first appears — it only becomes "armed" after the first paint.
  const [armed, setArmed] = useState(false);
  useEffect(() => setArmed(true), []);

  return (
    <label
      className={`task-row flex min-h-[44px] items-center gap-3 rounded-lg px-2 py-1.5 transition-colors duration-200 ${
        locked ? "cursor-default" : "cursor-pointer hover:bg-white/[0.04] active:bg-white/[0.06]"
      }`}
    >
      <input
        type="checkbox"
        className="tick-input"
        checked={completed}
        disabled={locked}
        onChange={(e) => {
          if (locked) return;
          const next = e.target.checked;
          if (next) setPopping(true);
          onToggle(next, e.currentTarget.closest("label") as HTMLElement);
        }}
      />
      <span
        className="tick-box"
        data-checked={completed}
        data-locked={locked}
        data-pop={popping}
        onAnimationEnd={() => setPopping(false)}
        aria-hidden="true"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="#10140d" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round">
          <path className="tick-path" d="M5 12.5l4.5 4.5L19 7.5" />
        </svg>
      </span>
      <span className="min-w-0 flex-1 break-words text-sm leading-snug">
        <span className={`task-text ${completed ? "text-ink-faint" : "text-ink"}`} data-checked={completed}>
          {name}
        </span>
      </span>
      {chain >= 2 && (
        <span
          key={chain}
          title={`${chain} in a row`}
          aria-label={`${chain} in a row`}
          className={`shrink-0 rounded-full bg-clay/15 px-2 py-0.5 font-mono text-[10px] font-medium leading-4 text-clay-strong ${
            armed ? "animate-bump" : ""
          }`}
        >
          {"\u00D7"}
          {chain}
        </span>
      )}
    </label>
  );
}
