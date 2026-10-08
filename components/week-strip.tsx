"use client";

import type { CSSProperties } from "react";
import { getProgressColor } from "@/lib/theme";
import { DAY_LABELS, DAY_SHORT_LABELS } from "@/lib/types";
import type { DayIndex, DayStat } from "@/lib/types";

/**
 * Seven cells, Saturday to Friday, each coloured on the same red-to-green
 * scale as everything else. Stacked week after week these *are* the yearly
 * heatmap — and because a week is a row, it stays readable on a 375px phone
 * where a 53-column grid would shrink to specks.
 *
 * A rest day (no tasks) is drawn neutral, never as the red of a 0% day.
 * In the live week, days that haven't happened are dashed outlines and
 * today is ringed, since neither is a verdict yet.
 */
export function WeekStrip({
  dayStats,
  todayIndex = null,
  labels = false,
  height = 18,
}: {
  dayStats: DayStat[];
  /** Pass for the live week; omit for a finished one. */
  todayIndex?: number | null;
  /** Draw "Sat 5/5" captions under the cells. */
  labels?: boolean;
  height?: number;
}) {
  return (
    <div>
      <div className="grid grid-cols-7 gap-1" style={{ height }}>
        {dayStats.map((s, i) => {
          const pct = s.total === 0 ? null : Math.round((s.done / s.total) * 100);
          const future = todayIndex !== null && i > todayIndex;
          const today = todayIndex !== null && i === todayIndex;
          const name = DAY_LABELS[i as DayIndex];
          const caption = s.total === 0 ? "rest day" : `${s.done} of ${s.total}`;

          let cls = "";
          const style: CSSProperties = { animationDelay: `${i * 45}ms` };
          if (future) {
            cls = "border border-dashed border-white/15";
          } else if (pct === null) {
            cls = "bg-white/[0.06]";
          } else {
            style.backgroundColor = getProgressColor(pct);
            if (today) {
              style.opacity = 0.7;
              cls = "ring-1 ring-inset ring-accent-strong";
            }
          }
          return (
            <span
              key={i}
              role="img"
              aria-label={`${name}: ${future ? "still ahead" : caption}`}
              title={`${name}: ${future ? "still ahead" : caption}`}
              className={`origin-bottom animate-bar-grow rounded-[5px] ${cls}`}
              style={style}
            />
          );
        })}
      </div>
      {labels && (
        <div className="mt-1.5 grid grid-cols-7 gap-1 text-center">
          {dayStats.map((s, i) => (
            <div key={i} className="font-mono leading-tight">
              <div className="text-[9px] uppercase text-ink-faint">{DAY_SHORT_LABELS[i as DayIndex]}</div>
              <div className="text-[10px] text-ink-muted">{s.total === 0 ? "rest" : `${s.done}/${s.total}`}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
