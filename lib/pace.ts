import { TARGET_PERCENT } from "./goals";
import type { CurrentWeek } from "./types";

/**
 * "What would it take to land on target?" — plain arithmetic, deliberately
 * not a verdict: the live week still passes no judgment, this only says how
 * many of the ticks that can still happen are needed.
 */
export type Pace =
  | { kind: "none" }
  | { kind: "reached"; target: number }
  | { kind: "need"; target: number; need: number; open: number }
  | { kind: "out"; target: number; best: number };

/** Fewest completed tasks, out of `total`, whose *displayed* percentage
 * (Math.round of the share, as everywhere in the app) reaches `target`.
 * Integer maths so no float edge case can be off by one: the share rounds to
 * `target` once it is at least target − 0.5. */
export function tasksNeededFor(total: number, target: number): number {
  if (total <= 0) return 0;
  return Math.min(total, Math.floor(((2 * target - 1) * total + 199) / 200));
}

/** Unticked tasks that can still be ticked: today's and every later day's.
 * Earlier days are locked for good, so their unticked tasks are gone. */
export function openTaskCount(week: CurrentWeek, todayIndex: number): number {
  let open = 0;
  for (const day of week.days) {
    if (day.dayIndex < todayIndex) continue;
    for (const t of day.tasks) if (!t.completed) open++;
  }
  return open;
}

export function computePace(
  total: number,
  completed: number,
  open: number,
  target: number = TARGET_PERCENT
): Pace {
  if (total <= 0) return { kind: "none" };
  const required = tasksNeededFor(total, target);
  const need = required - completed;
  if (need <= 0) return { kind: "reached", target };
  if (open < need) {
    return { kind: "out", target, best: Math.round(((completed + open) / total) * 100) };
  }
  return { kind: "need", target, need, open };
}

export function paceText(pace: Pace): string | null {
  switch (pace.kind) {
    case "none":
      return null;
    case "reached":
      return `${pace.target}% target reached`;
    case "need":
      return `Need ${pace.need} of the ${pace.open} open ${pace.open === 1 ? "task" : "tasks"} to reach ${pace.target}%`;
    case "out":
      return `Best possible now: ${pace.best}% \u2014 ${pace.target}% is out of reach`;
  }
}
