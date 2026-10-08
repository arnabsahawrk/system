import { percentOf } from "@/lib/stats";
import type { CurrentWeek } from "@/lib/types";

/** The live week with one task set to `completed`, totals and percentage
 * recomputed. The screen applies this the instant a box is tapped and does
 * not re-fetch afterwards, so the weekly card, rings and records strip must
 * all be able to follow from this alone. */
export function applyTick(week: CurrentWeek, taskId: string, completed: boolean): CurrentWeek {
  let found = false;
  const days = week.days.map((day) => {
    if (!day.tasks.some((t) => t.id === taskId)) return day;
    found = true;
    return { ...day, tasks: day.tasks.map((t) => (t.id === taskId ? { ...t, completed } : t)) };
  });
  if (!found) return week;
  let done = 0;
  let total = 0;
  for (const day of days) {
    total += day.tasks.length;
    for (const t of day.tasks) if (t.completed) done++;
  }
  return { ...week, days, completed: done, total, percent: percentOf(done, total) };
}

/** True when ticking `taskId` would finish its whole day: every other task
 * that day is already done, this one isn't yet, and the day has tasks. */
export function completesDay(week: CurrentWeek, taskId: string): boolean {
  const day = week.days.find((d) => d.tasks.some((t) => t.id === taskId));
  if (!day) return false;
  const target = day.tasks.find((t) => t.id === taskId);
  if (!target || target.completed) return false;
  return day.tasks.every((t) => t.id === taskId || t.completed);
}
