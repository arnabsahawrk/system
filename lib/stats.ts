import { MIN_TASK_SAMPLES } from "./goals";

/** Rounded 0–100 share. The same rounding every percentage in the app uses. */
export function percentOf(done: number, total: number): number {
  return total <= 0 ? 0 : Math.round((done / total) * 100);
}

/** Share over a set of rows, weighted by their size (not a mean of means). */
export function aggregatePercent(rows: { done: number; total: number }[]): number {
  let done = 0;
  let total = 0;
  for (const r of rows) {
    done += r.done;
    total += r.total;
  }
  return percentOf(done, total);
}

/** Run lengths over an oldest-to-newest list of yes/no flags: the run that
 * ends at the newest entry, and the longest run anywhere. */
export function runStats(flags: boolean[]): { current: number; longest: number } {
  let longest = 0;
  let run = 0;
  for (const f of flags) {
    run = f ? run + 1 : 0;
    if (run > longest) longest = run;
  }
  // `run` is now the trailing run — exactly the "current" streak.
  return { current: run, longest };
}

export interface TaskTally {
  name: string;
  done: number;
  total: number;
}

export interface RankedTask extends TaskTally {
  percent: number;
}

/** Weakest first. Tasks with too few occurrences are left out entirely — a
 * 1-for-1 task is not "100% consistent", it's just unmeasured. Ties go to
 * the task with more evidence, then alphabetical, so the order is stable. */
export function rankTasks(tallies: TaskTally[], minSamples: number = MIN_TASK_SAMPLES): RankedTask[] {
  return tallies
    .filter((t) => t.total >= minSamples)
    .map((t) => ({ ...t, percent: percentOf(t.done, t.total) }))
    .sort((a, b) => a.percent - b.percent || b.total - a.total || a.name.localeCompare(b.name));
}

/** Finished weeks in a row, walking back from `weekNumber`, at or above
 * `target`. A week missing from the list (or empty) ends the run. */
export function weekStreakEndingAt(
  weeks: { weekNumber: number; percent: number; total: number }[],
  weekNumber: number,
  target: number
): number {
  const byNumber = new Map(weeks.map((w) => [w.weekNumber, w]));
  let n = weekNumber;
  let count = 0;
  for (;;) {
    const w = byNumber.get(n);
    if (!w || w.total <= 0 || w.percent < target) break;
    count++;
    n--;
  }
  return count;
}

/** 0–1439 minutes since midnight → "9:40 PM". */
export function formatClock(minutesOfDay: number): string {
  const m = ((Math.round(minutesOfDay) % 1440) + 1440) % 1440;
  const h24 = Math.floor(m / 60);
  const mm = String(m % 60).padStart(2, "0");
  const suffix = h24 >= 12 ? "PM" : "AM";
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12}:${mm} ${suffix}`;
}

/** Median of a non-empty list (mean of the two middle values when even). */
export function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}
