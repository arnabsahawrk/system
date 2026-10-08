"use client";

import { useEffect, useRef, useState } from "react";
import { Flame, Minus, TrendingDown, TrendingUp, X } from "lucide-react";
import { DayRing } from "./day-ring";
import { NoteEditor } from "./records-list";
import { WeekStrip } from "./week-strip";
import { fireConfettiFrom } from "@/lib/confetti";
import { TARGET_PERCENT, TASK_WINDOW_WEEKS } from "@/lib/goals";
import { getProgressColor, getProgressMessage } from "@/lib/theme";
import { useCountUp } from "@/lib/use-count-up";
import type { Verdict } from "@/lib/types";

const CLOSE_MS = 260;

/**
 * Shown once, the first time the app is opened after a week has rolled over:
 * the week's verdict on screen, not only in the email. How it ended, how that
 * compares with the week before, the run it belongs to, the task that has
 * been slipping — and a chance to write down what got in the way.
 */
export function VerdictSheet({
  verdict,
  onClose,
  onNoteSaved,
}: {
  verdict: Verdict;
  onClose: () => void;
  onNoteSaved: (weekNumber: number, note: string | null) => void;
}) {
  const [closing, setClosing] = useState(false);
  const [note, setNote] = useState(verdict.note ?? "");
  const ringRef = useRef<HTMLDivElement>(null);
  const shown = useCountUp(verdict.percent, 900);
  const color = getProgressColor(verdict.percent);

  function close() {
    if (closing) return;
    // Make sure a half-typed note is saved: blurring the field triggers its autosave.
    (document.activeElement as HTMLElement | null)?.blur?.();
    setClosing(true);
    window.setTimeout(onClose, CLOSE_MS);
  }

  // Lock the page behind the sheet, close on Escape, and celebrate a perfect week.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    let t = 0;
    if (verdict.percent === 100) {
      t = window.setTimeout(() => fireConfettiFrom(ringRef.current), 450);
    }
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
      window.clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const delta = verdict.delta;
  const prev = verdict.prevWeek;
  const weakest = verdict.weakestTask;

  return (
    <div
      className={`fixed inset-0 z-[60] flex items-end justify-center bg-black/60 sm:items-center ${
        closing ? "animate-backdrop-out" : "animate-backdrop-in"
      }`}
      onClick={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="verdict-title"
        className={`max-h-[92vh] w-full max-w-sm overflow-y-auto overscroll-contain rounded-t-2xl border border-border bg-surface p-5 shadow-card sm:rounded-2xl ${
          closing ? "animate-sheet-down sm:animate-modal-out" : "animate-sheet-up sm:animate-modal-in"
        }`}
        // keep the button clear of the home indicator on notched phones
        style={{ paddingBottom: "max(1.5rem, env(safe-area-inset-bottom))" }}
      >
        <div className="mb-1 flex items-center justify-between">
          <h2 id="verdict-title" className="font-mono text-xs uppercase tracking-[0.2em] text-ink-muted">
            Week {verdict.weekNumber} closed
          </h2>
          <button
            onClick={close}
            aria-label="Close"
            className="rounded-lg p-1 text-ink-faint transition-colors hover:text-ink active:scale-90"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex flex-col items-center gap-1 pb-4 pt-2 text-center">
          <div ref={ringRef} className="relative">
            <DayRing percent={verdict.percent} size={132} strokeWidth={10} />
            <div
              className="absolute inset-0 flex items-center justify-center font-mono text-3xl font-bold tabular-nums"
              style={{ color }}
            >
              {shown}%
            </div>
          </div>
          <p className="mt-2 font-mono text-sm font-medium" style={{ color }}>
            {getProgressMessage(verdict.percent)}
          </p>
          <p className="font-mono text-xs text-ink-muted">
            {verdict.completed} of {verdict.total} goals completed
          </p>
        </div>

        <div className="mb-4 flex flex-wrap items-center justify-center gap-2">
          {delta !== null && prev && (
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-mono text-[11px] ${
                delta > 0
                  ? "bg-accent/15 text-accent-strong"
                  : delta < 0
                    ? "bg-clay/15 text-clay-strong"
                    : "bg-white/[0.06] text-ink-muted"
              }`}
            >
              {delta > 0 ? <TrendingUp size={13} /> : delta < 0 ? <TrendingDown size={13} /> : <Minus size={13} />}
              {delta > 0
                ? `+${delta} vs Week ${prev.weekNumber}`
                : delta < 0
                  ? `\u2212${Math.abs(delta)} vs Week ${prev.weekNumber}`
                  : `Same as Week ${prev.weekNumber}`}
            </span>
          )}
          {verdict.weekStreak >= 2 && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-clay/15 px-2.5 py-1 font-mono text-[11px] text-clay-strong">
              <Flame size={13} />
              {verdict.weekStreak} weeks at {TARGET_PERCENT}%+
            </span>
          )}
        </div>

        <WeekStrip dayStats={verdict.dayStats} labels height={22} />
        {verdict.perfectDays > 0 && (
          <p className="mt-2 text-center font-mono text-[11px] text-ink-faint">
            {verdict.perfectDays} perfect {verdict.perfectDays === 1 ? "day" : "days"}
          </p>
        )}

        {weakest && weakest.percent < 100 && (
          <div className="mt-4 rounded-xl border-l-2 border-clay/60 bg-black/20 px-3.5 py-3">
            <div className="mb-0.5 font-mono text-[10px] uppercase tracking-[0.18em] text-clay-strong">
              {weakest.percent >= TARGET_PERCENT ? "Weakest task" : "Needs attention"}
            </div>
            <p className="font-mono text-xs leading-snug text-ink">
              {weakest.name}
              <span className="text-ink-muted">
                {" "}
                &mdash; {weakest.percent}% over the last {TASK_WINDOW_WEEKS} weeks ({weakest.done} of {weakest.total})
              </span>
            </p>
          </div>
        )}

        <div className="mt-5">
          <NoteEditor
            weekNumber={verdict.weekNumber}
            saved={note}
            onSaved={(wn, n) => {
              setNote(n ?? "");
              onNoteSaved(wn, n);
            }}
          />
        </div>

        <button
          onClick={close}
          className="mt-3 w-full rounded-xl bg-accent py-3 font-mono text-sm font-medium text-[#10140d] transition-all duration-200 hover:bg-accent-strong active:scale-[0.98]"
        >
          Got it
        </button>
      </div>
    </div>
  );
}
