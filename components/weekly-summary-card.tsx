"use client";

import { Check, Target } from "lucide-react";
import { BrandMark } from "./brand-mark";
import { DayRing } from "./day-ring";
import { computePace, openTaskCount, paceText } from "@/lib/pace";
import { getProgressColor } from "@/lib/theme";
import { useArmed } from "@/lib/use-armed";
import { useCountUp } from "@/lib/use-count-up";
import { DAY_LABELS, DAY_SHORT_LABELS } from "@/lib/types";
import type { CurrentWeek } from "@/lib/types";

/** Deliberately no verdict here — the live, still-running week isn't one yet.
 * Messages only appear in Records once a week is done. The pace line is the
 * exception that proves the rule: it is arithmetic (how many of the ticks
 * that can still happen are needed for the target), not a judgment. */
export function WeeklySummaryCard({
  week,
  todayIndex,
  compact = false,
  selectedDay = null,
  onSelectDay,
}: {
  week: CurrentWeek;
  todayIndex: number;
  /** Tighter spacing, for the phone layout where it sits under today's card. */
  compact?: boolean;
  selectedDay?: number | null;
  /** When given, the seven day rings become buttons. */
  onSelectDay?: (dayIndex: number) => void;
}) {
  const color = getProgressColor(week.percent);
  const shown = useCountUp(week.percent);
  const armed = useArmed();
  const pace = computePace(week.total, week.completed, openTaskCount(week, todayIndex));
  const paceLine = paceText(pace);

  return (
    <div
      className={`flex flex-col rounded-xl2 border border-border bg-surface shadow-card ${
        compact ? "gap-4 p-4" : "gap-5 p-5"
      }`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <BrandMark size={26} />
          <div>
            <div className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink-muted">This week</div>
            <div className="font-mono text-[11px] text-ink-faint">Week {week.weekNumber}</div>
          </div>
        </div>
      </div>

      <div className={`flex flex-col items-center gap-2 ${compact ? "py-1" : "py-4"}`}>
        <div
          className={`font-mono font-bold tabular-nums ${compact ? "text-5xl" : "text-6xl"}`}
          style={{ color, transition: "color 0.5s ease" }}
        >
          {shown}%
        </div>
        <div className="text-xs text-ink-muted">
          {week.completed} of {week.total} goals completed
        </div>
      </div>

      <div className="flex flex-col gap-2.5">
        <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full rounded-full"
            style={{
              width: `${armed ? week.percent : 0}%`,
              backgroundColor: color,
              transition: "width 0.7s cubic-bezier(0.22,1,0.36,1), background-color 0.5s ease",
            }}
          />
        </div>
        <div className="min-h-[18px]" aria-live="polite">
          {paceLine && (
            <p
              key={paceLine}
              className={`flex animate-fade-in items-center gap-1.5 font-mono text-[11px] leading-snug ${
                pace.kind === "reached"
                  ? "text-accent-strong"
                  : pace.kind === "out"
                    ? "text-clay-strong"
                    : "text-ink-muted"
              }`}
            >
              {pace.kind === "reached" ? (
                <Check size={12} strokeWidth={3} className="shrink-0" />
              ) : (
                <Target size={12} className="shrink-0" />
              )}
              {paceLine}
            </p>
          )}
        </div>
      </div>

      <div className="flex justify-between gap-1">
        {week.days.map((day, i) => {
          const done = day.tasks.filter((t) => t.completed).length;
          const total = day.tasks.length;
          const pct = total === 0 ? 0 : (done / total) * 100;
          const isToday = i === todayIndex;
          const body = (
            <>
              <div className={isToday ? "opacity-100" : "opacity-70"}>
                <DayRing percent={pct} />
              </div>
              <span className={`font-mono text-[9px] uppercase ${isToday ? "text-ink" : "text-ink-faint"}`}>
                {DAY_SHORT_LABELS[day.dayIndex]}
              </span>
              <span className="font-mono text-[10px] text-ink-muted">{done}</span>
            </>
          );
          const base = "flex flex-col items-center gap-1 rounded-lg px-1 py-1.5";
          return onSelectDay ? (
            <button
              key={day.dayIndex}
              type="button"
              onClick={() => onSelectDay(i)}
              aria-label={`${DAY_LABELS[day.dayIndex]}: ${done} of ${total} done`}
              aria-pressed={selectedDay === i}
              className={`${base} transition-all duration-200 active:scale-90 ${
                selectedDay === i ? "bg-white/[0.07]" : "hover:bg-white/[0.04]"
              }`}
            >
              {body}
            </button>
          ) : (
            <div key={day.dayIndex} className={base}>
              {body}
            </div>
          );
        })}
      </div>
    </div>
  );
}
