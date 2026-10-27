import { RESET_HOUR, getLocalMinutesOfDay } from "./date";
import { aggregatePercent, formatClock, median, percentOf, rankTasks, runStats } from "./stats";
import type { DayIndex } from "./types";

/**
 * Everything on the Insights page, as a pure function of rows the database
 * already holds — nothing here is stored, cached or counted ahead of time, so
 * there is no number that can drift out of step with the actual ticks. The
 * SQL that feeds this lives in lib/insights-db.ts.
 *
 * It looks at everything, from the first day: no "last 4 weeks" windows.
 * Three rules keep the numbers honest:
 *  - Only days that have *closed* (before today's 06:00-based date) count
 *    towards rates and can end a streak. Today and the days ahead are not
 *    failures, they're unfinished.
 *  - A day with no tasks is a rest day: invisible to every streak and rate.
 *  - Today can only *add* to a streak (once it qualifies); it never removes
 *    one while it is still open.
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
  /** Per-task tallies over closed days. */
  tasks: TaskRow[];
  /** Every completed tick. */
  ticks: TickRow[];
}

export interface StreakPair {
  current: number;
  longest: number;
}

export interface Insights {
  /** False until at least one day with tasks has closed. */
  hasData: boolean;
  overview: {
    /** Share of tasks done on finished days, 0–100. */
    percent: number;
    done: number;
    total: number;
    finishedWeeks: number;
    /** Days when every task was done (today included once it is). */
    perfectDays: number;
  };
  streaks: {
    /** Days in a row with every task done. */
    perfect: StreakPair;
    /** Days in a row with at least one task done. */
    active: StreakPair;
  };
  weeks: {
    /** Every finished week, oldest first. */
    list: { weekNumber: number; percent: number }[];
    average: number | null;
    best: { weekNumber: number; percent: number } | null;
    /** The newest finished week; `vsAverage` is null until there are two. */
    latest: { weekNumber: number; percent: number; vsAverage: number | null } | null;
  };
  /** Sat..Fri. percent is null for a weekday that has no closed day yet. */
  weekdays: { dayIndex: DayIndex; percent: number | null; days: number }[];
  /** The strongest and weakest weekday; null until two weekdays differ. */
  dayExtremes: {
    best: { dayIndex: DayIndex; percent: number };
    worst: { dayIndex: DayIndex; percent: number };
  } | null;
  /** Weakest first; tasks seen fewer than MIN_TASK_SAMPLES times are left out. */
  tasks: { name: string; percent: number; done: number; total: number }[];
  clock: {
    ticks: number;
    /** Typical time of day a task gets ticked, e.g. "9:40 PM". */
    medianLabel: string | null;
    /** 24 buckets; index 0 is the 06:00 hour (the day's start), 23 is 05:00. */
    hourBuckets: number[];
    /** Closed days that had at least one tick. */
    tickDays: number;
    /** Of those, days whose last tick landed after midnight (before 06:00). */
    afterMidnightDays: number;
  };
}

/** Minutes after the 06:00 day start at which wall-clock midnight falls. */
const MIDNIGHT_OFFSET = (24 - RESET_HOUR) * 60;

const DAY_INDEXES = [0, 1, 2, 3, 4, 5, 6] as DayIndex[];

function byDate(a: DayRow, b: DayRow): number {
  return a.date < b.date ? -1 : a.date > b.date ? 1 : 0;
}

export function computeInsights(input: InsightsInput): Insights {
  const { todayKey, timeZone } = input;
  const withTasks = input.days.filter((d) => d.total > 0);
  const closed = withTasks.filter((d) => d.date < todayKey).sort(byDate);
  const today = withTasks.find((d) => d.date === todayKey) ?? null;

  // --- streaks -------------------------------------------------------------
  const perfectFlags = closed.map((d) => d.done === d.total);
  const activeFlags = closed.map((d) => d.done > 0);
  if (today) {
    if (today.done === today.total) perfectFlags.push(true);
    if (today.done > 0) activeFlags.push(true);
  }

  // --- weeks ---------------------------------------------------------------
  const weekMap = new Map<number, { weekNumber: number; finalized: boolean; done: number; total: number }>();
  for (const d of withTasks) {
    const w = weekMap.get(d.weekNumber) ?? { weekNumber: d.weekNumber, finalized: d.finalized, done: 0, total: 0 };
    w.done += d.done;
    w.total += d.total;
    weekMap.set(d.weekNumber, w);
  }
  const finished = [...weekMap.values()]
    .filter((w) => w.finalized)
    .sort((a, b) => a.weekNumber - b.weekNumber)
    .map((w) => ({ ...w, percent: percentOf(w.done, w.total) }));

  const average = finished.length === 0 ? null : aggregatePercent(finished);
  let best: Insights["weeks"]["best"] = null;
  for (const w of finished) {
    if (!best || w.percent >= best.percent) best = { weekNumber: w.weekNumber, percent: w.percent };
  }
  const newest = finished[finished.length - 1];
  const latest: Insights["weeks"]["latest"] = newest
    ? {
        weekNumber: newest.weekNumber,
        percent: newest.percent,
        vsAverage: finished.length >= 2 && average !== null ? newest.percent - average : null,
      }
    : null;

  // --- overview ------------------------------------------------------------
  const done = closed.reduce((n, d) => n + d.done, 0);
  const total = closed.reduce((n, d) => n + d.total, 0);

  // --- weekdays ------------------------------------------------------------
  const weekdays = DAY_INDEXES.map((dayIndex) => {
    const rows = closed.filter((d) => d.dayIndex === dayIndex);
    return { dayIndex, percent: rows.length === 0 ? null : aggregatePercent(rows), days: rows.length };
  });
  let strongest: { dayIndex: DayIndex; percent: number } | null = null;
  let weakest: { dayIndex: DayIndex; percent: number } | null = null;
  let withData = 0;
  for (const w of weekdays) {
    if (w.percent === null) continue;
    withData++;
    if (!strongest || w.percent > strongest.percent) strongest = { dayIndex: w.dayIndex, percent: w.percent };
    if (!weakest || w.percent < weakest.percent) weakest = { dayIndex: w.dayIndex, percent: w.percent };
  }
  const dayExtremes =
    withData >= 2 && strongest && weakest && strongest.percent > weakest.percent
      ? { best: strongest, worst: weakest }
      : null;

  // --- tasks ---------------------------------------------------------------
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
  for (const [date, last] of latestByDate) {
    if (date >= todayKey) continue; // today is still open — it hasn't "closed" at any time yet
    tickDays++;
    if (last >= MIDNIGHT_OFFSET) afterMidnightDays++;
  }
  const med = median(minutes);

  return {
    hasData: closed.length > 0,
    overview: {
      percent: percentOf(done, total),
      done,
      total,
      finishedWeeks: finished.length,
      perfectDays: perfectFlags.filter(Boolean).length,
    },
    streaks: { perfect: runStats(perfectFlags), active: runStats(activeFlags) },
    weeks: {
      list: finished.map((w) => ({ weekNumber: w.weekNumber, percent: w.percent })),
      average,
      best,
      latest,
    },
    weekdays,
    dayExtremes,
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
