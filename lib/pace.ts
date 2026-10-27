import { percentOf } from "./stats";
import type { CurrentWeek } from "./types";

/**
 * What today adds to the week — plain arithmetic, not a verdict: the week
 * still passes no judgment while it runs. This only says how far finishing
 * today's tasks would carry it: what is ticked so far, plus what is still open
 * today.
 */
export type Pace =
  | { kind: "none" }
  | { kind: "rest"; percent: number }
  | { kind: "open"; open: number; total: number; target: number }
  | { kind: "done"; percent: number };

export function computePace(week: CurrentWeek, todayIndex: number): Pace {
  if (week.total <= 0) return { kind: "none" };
  const today = week.days.find((d) => d.dayIndex === todayIndex);
  if (!today || today.tasks.length === 0) return { kind: "rest", percent: week.percent };

  const total = today.tasks.length;
  const open = today.tasks.filter((t) => !t.completed).length;
  if (open === 0) return { kind: "done", percent: week.percent };

  // The same rounding as every percentage in the app, so once the last task
  // is ticked the big number on the card is exactly this one — whatever else
  // the rest of the week holds.
  return { kind: "open", open, total, target: percentOf(week.completed + open, week.total) };
}

export function paceText(pace: Pace): string | null {
  switch (pace.kind) {
    case "none":
      return null;
    case "rest":
      return `Rest day \u2014 the week holds at ${pace.percent}%`;
    case "done":
      return `Today's done \u2014 the week is at ${pace.percent}%`;
    case "open":
      if (pace.total === 1) return `Finish today's task to reach ${pace.target}%`;
      if (pace.open === pace.total) return `Finish all ${pace.total} today to reach ${pace.target}%`;
      return `Finish ${pace.open} more today to reach ${pace.target}%`;
  }
}
