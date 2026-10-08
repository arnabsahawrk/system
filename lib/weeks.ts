import sql from "@/lib/db";
import { ensureCurrentWeek } from "@/lib/rollover";
import { getAppDateKey, getWeekDateKeys } from "@/lib/date";
import { getNote, getNotesFor } from "@/lib/notes";
import { percentOf } from "@/lib/stats";
import type {
  CurrentWeek,
  DayEntry,
  DayIndex,
  DayStat,
  HistoryPage,
  WeekDetail,
  WeekSummary,
} from "@/lib/types";

const DAY_INDEXES = [0, 1, 2, 3, 4, 5, 6] as DayIndex[];

interface TaskRow {
  day_index: number;
  date: string;
  id: string;
  name: string;
  completed: boolean;
}

/** Seven day entries (Sat..Fri) from a week's task rows. Every day gets its
 * *real* calendar date, rest days included. */
function buildDays(startDateKey: string, tasks: TaskRow[], chains?: Map<string, number>, todayKey?: string): DayEntry[] {
  const dateKeys = getWeekDateKeys(startDateKey);
  return DAY_INDEXES.map((dayIndex) => {
    const dateKey = dateKeys[dayIndex];
    return {
      dayIndex,
      dateKey,
      tasks: tasks
        .filter((t) => t.day_index === dayIndex)
        .map((t) => ({
          id: t.id,
          name: t.name,
          completed: t.completed,
          // Chains are only ever shown on the one unlocked day.
          ...(chains && todayKey === dateKey ? { chain: chains.get(t.name) ?? 0 } : {}),
        })),
    };
  });
}

function dayStatsOf(days: DayEntry[]): DayStat[] {
  return days.map((d) => ({ done: d.tasks.filter((t) => t.completed).length, total: d.tasks.length }));
}

/** For each task name scheduled today: how many of its scheduled occurrences
 * were finished in a row, ending at its most recent *closed* occurrence.
 * Days a task isn't scheduled on are simply absent from its history, so a
 * Mon/Wed/Fri habit chains Mon -> Wed -> Fri. Today itself is excluded — the
 * client adds one while today's box is ticked. */
async function getChainBases(todayKey: string): Promise<Map<string, number>> {
  const rows = await sql<{ name: string; chain: number }[]>`
    with todays as (
      select distinct name from week_tasks where date = ${todayKey}
    ), occ as (
      select wt.name, wt.date, bool_and(wt.completed) as done
      from week_tasks wt
      join todays t on t.name = wt.name
      where wt.date < ${todayKey}
      group by wt.name, wt.date
    ), ranked as (
      select name, done, row_number() over (partition by name order by date desc) as rn from occ
    )
    select name,
           coalesce(min(rn) filter (where not done) - 1, count(*))::int as chain
    from ranked
    group by name
  `;
  return new Map(rows.map((r) => [r.name, r.chain]));
}

/** Always call this before reading/writing week data — it's what makes the
 * rollover happen "automatically": no cron has to have run yet, this call
 * itself brings the database up to date with `now` if it's behind. */
export async function getCurrentWeek(now: Date): Promise<CurrentWeek | null> {
  await ensureCurrentWeek(now);

  const [settingsRow] = await sql<{ paused: boolean; timezone: string }[]>`
    select paused, timezone from user_settings where singleton = true
  `;
  // Paused: the last real week already finalized normally at the boundary
  // (see lib/rollover.ts) — there is deliberately no "current" week to
  // show. The dashboard renders its paused screen for this, rather than
  // displaying that closed week as if it were still live.
  if (settingsRow?.paused) return null;

  const [week] = await sql<{ id: string; week_number: number; start_date: string }[]>`
    select id, week_number, start_date from weeks order by week_number desc limit 1
  `;
  if (!week) return null; // never started yet

  const tasks = await sql<TaskRow[]>`
    select day_index, date, id, name, completed from week_tasks
    where week_id = ${week.id} order by day_index, sort_order
  `;

  const todayKey = getAppDateKey(now, settingsRow?.timezone ?? "Asia/Dhaka");
  const hasToday = tasks.some((t) => t.date === todayKey);
  const chains = hasToday ? await getChainBases(todayKey) : undefined;

  const days = buildDays(week.start_date, tasks, chains, todayKey);
  const total = tasks.length;
  const completed = tasks.filter((t) => t.completed).length;

  return {
    weekNumber: week.week_number,
    startDateKey: week.start_date,
    completed,
    total,
    percent: percentOf(completed, total),
    finalized: false,
    days,
  };
}

export type ToggleResult = "ok" | "not-found" | "locked";

/** Ticks or unticks one task. Enforced here, not just in the UI: a task can
 * only change if it belongs to *today's* row (per the 6am rule), so a direct
 * API call can't back-date or future-date a tick any more than the UI can.
 *
 * With `desired` the task is set to exactly that state, which makes the call
 * idempotent — a retry, or a second device with a stale screen, can never
 * flip it the wrong way. Without it the task is flipped (the original
 * behaviour). A tick keeps its original completed_at if it is already on. */
export async function toggleTask(
  taskId: string,
  now: Date,
  timeZone: string,
  desired?: boolean
): Promise<ToggleResult> {
  const todayKey = getAppDateKey(now, timeZone);
  const [target] = await sql<{ date: string }[]>`select date from week_tasks where id = ${taskId}`;
  if (!target) return "not-found";
  if (target.date !== todayKey) return "locked";

  const updated =
    desired === undefined
      ? await sql`
          update week_tasks
          set completed = not completed,
              completed_at = case when not completed then now() else null end
          where id = ${taskId} and date = ${todayKey}
          returning id
        `
      : await sql`
          update week_tasks
          set completed = ${desired},
              completed_at = case when ${desired}::boolean then coalesce(completed_at, now()) else null end
          where id = ${taskId} and date = ${todayKey}
          returning id
        `;
  // The day flipped between the check and the write (06:00 passed mid-request).
  if (updated.length === 0) return "locked";
  return "ok";
}

const HISTORY_PAGE_SIZE = 10;

/** Newest-first, paginated (10 at a time) — see lib/types.ts HistoryPage.
 * `stats` is computed over *every* finalized week regardless of page size,
 * so the Tracker's all-time averages stay correct as more pages load.
 * Each week also carries its seven day cells (for the Records strip) and its
 * note, if it has one. */
export async function getHistoryPage(beforeWeekNumber?: number): Promise<HistoryPage> {
  const rows = beforeWeekNumber
    ? await sql<{ week_number: number; start_date: string; total: number; completed: number }[]>`
        select w.week_number, w.start_date,
          count(wt.id)::int as total, count(wt.id) filter (where wt.completed)::int as completed
        from weeks w
        left join week_tasks wt on wt.week_id = w.id
        where w.finalized = true and w.week_number < ${beforeWeekNumber}
        group by w.id order by w.week_number desc limit ${HISTORY_PAGE_SIZE + 1}
      `
    : await sql<{ week_number: number; start_date: string; total: number; completed: number }[]>`
        select w.week_number, w.start_date,
          count(wt.id)::int as total, count(wt.id) filter (where wt.completed)::int as completed
        from weeks w
        left join week_tasks wt on wt.week_id = w.id
        where w.finalized = true
        group by w.id order by w.week_number desc limit ${HISTORY_PAGE_SIZE + 1}
      `;

  const hasMore = rows.length > HISTORY_PAGE_SIZE;
  const page = rows.slice(0, HISTORY_PAGE_SIZE);
  const weekNumbers = page.map((r) => r.week_number);

  // Day cells and notes for just this page's weeks (week numbers are
  // consecutive, so a range covers them exactly).
  const minWeek = weekNumbers.length ? Math.min(...weekNumbers) : 0;
  const maxWeek = weekNumbers.length ? Math.max(...weekNumbers) : 0;
  const [dayRows, notes] = await Promise.all([
    weekNumbers.length
      ? sql<{ week_number: number; day_index: number; total: number; done: number }[]>`
          select w.week_number, wt.day_index,
            count(*)::int as total, count(*) filter (where wt.completed)::int as done
          from week_tasks wt join weeks w on w.id = wt.week_id
          where w.finalized = true and w.week_number between ${minWeek} and ${maxWeek}
          group by w.week_number, wt.day_index
        `
      : Promise.resolve([] as { week_number: number; day_index: number; total: number; done: number }[]),
    getNotesFor(weekNumbers),
  ]);

  const weeks: WeekSummary[] = page.map((r) => {
    const dayStats: DayStat[] = DAY_INDEXES.map((i) => {
      const hit = dayRows.find((d) => d.week_number === r.week_number && d.day_index === i);
      return { done: hit?.done ?? 0, total: hit?.total ?? 0 };
    });
    return {
      weekNumber: r.week_number,
      startDateKey: r.start_date,
      total: r.total,
      completed: r.completed,
      percent: percentOf(r.completed, r.total),
      finalized: true,
      dayStats,
      note: notes.get(r.week_number) ?? null,
    };
  });

  const [stats] = await sql<{ week_count: number; avg_completed: number; avg_total: number }[]>`
    select
      count(distinct w.id)::int as week_count,
      coalesce(avg(per_week.completed), 0)::float as avg_completed,
      coalesce(avg(per_week.total), 0)::float as avg_total
    from weeks w
    join lateral (
      select count(*)::int as total, count(*) filter (where wt.completed)::int as completed
      from week_tasks wt where wt.week_id = w.id
    ) per_week on true
    where w.finalized = true
  `;

  const weekCount = stats?.week_count ?? 0;
  const avgCompleted = stats?.avg_completed ?? 0;
  const avgTotal = stats?.avg_total ?? 0;

  return {
    weeks,
    hasMore,
    stats: {
      weekCount,
      avgCompleted: Math.round(avgCompleted * 10) / 10,
      avgTotal: Math.round(avgTotal * 10) / 10,
      avgPercent: avgTotal === 0 ? 0 : Math.round((avgCompleted / avgTotal) * 100),
    },
  };
}

/** One *finished* week with every task — what the Records post-mortem lists.
 * The live week is deliberately not available here: it isn't a verdict yet. */
export async function getWeekDetail(weekNumber: number): Promise<WeekDetail | null> {
  const [week] = await sql<{ id: string; week_number: number; start_date: string; finalized: boolean }[]>`
    select id, week_number, start_date, finalized from weeks where week_number = ${weekNumber}
  `;
  if (!week || !week.finalized) return null;

  const [tasks, note] = await Promise.all([
    sql<TaskRow[]>`
      select day_index, date, id, name, completed from week_tasks
      where week_id = ${week.id} order by day_index, sort_order
    `,
    getNote(weekNumber),
  ]);

  const days = buildDays(week.start_date, tasks);
  const total = tasks.length;
  const completed = tasks.filter((t) => t.completed).length;
  return {
    weekNumber: week.week_number,
    startDateKey: week.start_date,
    completed,
    total,
    percent: percentOf(completed, total),
    finalized: true,
    dayStats: dayStatsOf(days),
    note,
    days,
  };
}
