import { TARGET_PERCENT } from "./goals";
import { RESET_HOUR, getLocalMinutesOfDay } from "./date";
import { aggregatePercent, formatClock, median, percentOf, rankTasks, runStats } from "./stats";
import type { DayIndex } from "./types";

/**
 * Everything on the Insights page, as a pure function of rows the database
 * already holds — nothing here is stored, cached or counted ahead of time, so
 * there is no number that can drift out of step with the actual ticks. The
 * SQL that feeds this lives in lib/insights-db.ts.
 *
 * Three rules keep the numbers honest:
 *  - Only days that have *closed* (before today's 06:00-based date) can ever
 *    break a streak or drag a rate down. Today and the days ahead are not
 *    failures, they're unfinished.
 *  - A day with no tasks is a rest day: invisible to every streak and rate.
 *  - Today can only *add* to a streak (once it is finished); it never
 *    removes one while it is still open.
 */

export interface DayRow {
  /** YYYY-MM-DD */
  date: string;
  dayIndex: number;
  weekNumber: number;
  finalized: boolean;
  total: number;
  done: number;
}

export interface TaskRow {
  name: string;
  total: number;
  done: number;
}

export interface TickRow {
  /** The app-day (YYYY-MM-DD) the tick belongs to. */
  date: string;
  completedAt: Date;
}

export interface InsightsInput {
  /** The current app-day, YYYY-MM-DD. */
  todayKey: string;
  timeZone: string;
  days: DayRow[];
  /** Per-task tallies over the recent window, closed days only. */
  tasks: TaskRow[];
  /** Completed ticks over the recent window. */
  ticks: TickRow[];
}

export interface StreakPair {
  current: number;
  longest: number;
}

export interface Insights {
  /** False until at least one day with tasks has closed. */
  hasData: boolean;
  closedDays: number;
  finishedWeeks: number;
  streaks: {
    perfectDays: StreakPair;
    strongDays: StreakPair;
    weeks: StreakPair;
  };
  bests: {
    bestWeek: { weekNumber: number; percent: number; done: number; total: number } | null;
    mostTasks: { weekNumber: number; done: number } | null;
    biggestJump: { weekNumber: number; fromWeekNumber: number; delta: number } | null;
    perfectDays: number;
  };
  shape: {
    /** Sat..Fri. percent is null for a weekday that has no closed day yet. */
    weekdays: { dayIndex: DayIndex; percent: number | null; days: number }[];
    sampleWeeks: number;
    trend: { weeks: number; recent: number; prior: number; delta: number } | null;
  };
  /** Weakest first; tasks seen fewer than MIN_TASK_SAMPLES times are left out. */
  tasks: { name: string; percent: number; done: number; total: number }[];
  clock: {
    ticks: number;
    /** Typical time of day a task gets ticked, e.g. "9:40 PM". */
    medianLabel: string | null;
    /** 24 buckets; index 0 is the 06:00 hour (the day's start), 23 is 05:00. */
    hourBuckets: number[];
    /** Closed days in the window that had at least one tick. */
    tickDays: number;
    /** Of those, days whose last tick landed after midnight (the 06:00 grace window). */
    afterMidnightDays: number;
  };
}

/** Minutes after the 06:00 day start at which wall-clock midnight falls. */
const MIDNIGHT_OFFSET = (24 - RESET_HOUR) * 60;

function byDate(a: DayRow, b: DayRow): number {
  return a.date < b.date ? -1 : a.date > b.date ? 1 : 0;
}

export function computeInsights(input: InsightsInput): Insights {
  const { todayKey, timeZone } = input;
  const withTasks = input.days.filter((d) => d.total > 0);
  const closed = withTasks.filter((d) => d.date < todayKey).sort(byDate);
  const today = withTasks.find((d) => d.date === todayKey) ?? null;

  // --- day streaks -------------------------------------------------------
  const perfectFlags = closed.map((d) => d.done === d.total);
  const strongFlags = closed.map((d) => percentOf(d.done, d.total) >= TARGET_PERCENT);
  if (today) {
    if (today.done === today.total) perfectFlags.push(true);
    if (percentOf(today.done, today.total) >= TARGET_PERCENT) strongFlags.push(true);
  }

  // --- weeks -------------------------------------------------------------
  const weekMap = new Map<number, { weekNumber: number; finalized: boolean; done: number; total: number }>();
  for (const d of withTasks) {
    const w = weekMap.get(d.weekNumber) ?? {
      weekNumber: d.weekNumber,
      finalized: d.finalized,
      done: 0,
      total: 0,
    };
    w.done += d.done;
    w.total += d.total;
    weekMap.set(d.weekNumber, w);
  }
  const finished = [...weekMap.values()]
    .filter((w) => w.finalized)
    .sort((a, b) => a.weekNumber - b.weekNumber)
    .map((w) => ({ ...w, percent: percentOf(w.done, w.total) }));

  const weekFlags = finished.map((w) => w.percent >= TARGET_PERCENT);

  // --- personal bests ------------------------------------------------------
  let bestWeek: Insights["bests"]["bestWeek"] = null;
  let mostTasks: Insights["bests"]["mostTasks"] = null;
  for (const w of finished) {
    if (
      !bestWeek ||
      w.percent > bestWeek.percent ||
      (w.percent === bestWeek.percent && w.done >= bestWeek.done)
    ) {
      bestWeek = { weekNumber: w.weekNumber, percent: w.percent, done: w.done, total: w.total };
    }
    if (!mostTasks || w.done >= mostTasks.done) {
      mostTasks = { weekNumber: w.weekNumber, done: w.done };
    }
  }
  let biggestJump: Insights["bests"]["biggestJump"] = null;
  for (let i = 1; i < finished.length; i++) {
    const prev = finished[i - 1]!;
    const cur = finished[i]!;
    if (cur.weekNumber !== prev.weekNumber + 1) continue; // only back-to-back weeks
    const delta = cur.percent - prev.percent;
    if (delta > 0 && (!biggestJump || delta >= biggestJump.delta)) {
      biggestJump = { weekNumber: cur.weekNumber, fromWeekNumber: prev.weekNumber, delta };
    }
  }
  const perfectDays = perfectFlags.filter(Boolean).length;

  // --- shape ---------------------------------------------------------------
  const weekdays = ([0, 1, 2, 3, 4, 5, 6] as DayIndex[]).map((dayIndex) => {
    const rows = closed.filter((d) => d.dayIndex === dayIndex);
    return {
      dayIndex,
      percent: rows.length === 0 ? null : aggregatePercent(rows),
      days: rows.length,
    };
  });
  const sampleWeeks = new Set(closed.map((d) => d.weekNumber)).size;

  let trend: Insights["shape"]["trend"] = null;
  if (finished.length >= 2) {
    const k = Math.min(4, Math.floor(finished.length / 2));
    const recentRows = finished.slice(finished.length - k);
    const priorRows = finished.slice(finished.length - 2 * k, finished.length - k);
    const recent = aggregatePercent(recentRows);
    const prior = aggregatePercent(priorRows);
    trend = { weeks: k, recent, prior, delta: recent - prior };
  }

  // --- task consistency ----------------------------------------------------
  const tasks = rankTasks(input.tasks).map((t) => ({
    name: t.name,
    percent: t.percent,
    done: t.done,
    total: t.total,
  }));

  // --- clock ---------------------------------------------------------------
  const hourBuckets = new Array<number>(24).fill(0);
  const minutes: number[] = [];
  const latestByDate = new Map<string, number>();
  for (const t of input.ticks) {
    const sinceDayStart = (getLocalMinutesOfDay(t.completedAt, timeZone) - RESET_HOUR * 60 + 1440) % 1440;
    minutes.push(sinceDayStart);
    hourBuckets[Math.floor(sinceDayStart / 60)]!++;
    const prev = latestByDate.get(t.date);
    if (prev === undefined || sinceDayStart > prev) latestByDate.set(t.date, sinceDayStart);
  }
  let tickDays = 0;
  let afterMidnightDays = 0;
  for (const [date, latest] of latestByDate) {
    if (date >= todayKey) continue; // today is still open — it hasn't "closed" at any time yet
    tickDays++;
    if (latest >= MIDNIGHT_OFFSET) afterMidnightDays++;
  }
  const med = median(minutes);

  return {
    hasData: closed.length > 0,
    closedDays: closed.length,
    finishedWeeks: finished.length,
    streaks: {
      perfectDays: runStats(perfectFlags),
      strongDays: runStats(strongFlags),
      weeks: runStats(weekFlags),
    },
    bests: { bestWeek, mostTasks, biggestJump, perfectDays },
    shape: { weekdays, sampleWeeks, trend },
    tasks,
    clock: {
      ticks: minutes.length,
      medianLabel: med === null ? null : formatClock((med + RESET_HOUR * 60) % 1440),
      hourBuckets,
      tickDays,
      afterMidnightDays,
    },
  };
}
