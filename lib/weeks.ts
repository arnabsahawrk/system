import sql from "@/lib/db";
import { ensureCurrentWeek } from "@/lib/rollover";
import { getAppDateKey } from "@/lib/date";
import type { CurrentWeek, DayEntry, DayIndex, HistoryPage, WeekSummary } from "@/lib/types";

/** Always call this before reading/writing week data — it's what makes the
 * rollover happen "automatically": no cron has to have run yet, this call
 * itself brings the database up to date with `now` if it's behind. */
export async function getCurrentWeek(now: Date): Promise<CurrentWeek | null> {
  await ensureCurrentWeek(now);

  const [settingsRow] = await sql<{ paused: boolean }[]>`
    select paused from user_settings where singleton = true
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

  const tasks = await sql<{ day_index: number; date: string; id: string; name: string; completed: boolean }[]>`
    select day_index, date, id, name, completed from week_tasks
    where week_id = ${week.id} order by day_index, sort_order
  `;

  const dayIndexes = [0, 1, 2, 3, 4, 5, 6] as DayIndex[];
  const days: DayEntry[] = dayIndexes.map((dayIndex) => {
    const dayTasks = tasks.filter((t) => t.day_index === dayIndex);
    return {
      dayIndex,
      dateKey: dayTasks[0]?.date ?? week.start_date,
      tasks: dayTasks.map((t) => ({ id: t.id, name: t.name, completed: t.completed })),
    };
  });
  const total = tasks.length;
  const completed = tasks.filter((t) => t.completed).length;

  return {
    weekNumber: week.week_number,
    startDateKey: week.start_date,
    completed,
    total,
    percent: total === 0 ? 0 : Math.round((completed / total) * 100),
    finalized: false,
    days,
  };
}

export type ToggleResult = "ok" | "not-found" | "locked";

/** Flips one task. Enforced here, not just in the UI: a task can only be
 * toggled if it belongs to *today's* row (per the 6am rule), so a direct
 * API call can't back-date or future-date a tick any more than the UI can. */
export async function toggleTask(taskId: string, now: Date, timeZone: string): Promise<ToggleResult> {
  const todayKey = getAppDateKey(now, timeZone);
  const [target] = await sql<{ date: string }[]>`select date from week_tasks where id = ${taskId}`;
  if (!target) return "not-found";
  if (target.date !== todayKey) return "locked";

  await sql`
    update week_tasks
    set completed = not completed, completed_at = case when not completed then now() else null end
    where id = ${taskId}
  `;
  return "ok";
}

const HISTORY_PAGE_SIZE = 10;

/** Newest-first, paginated (10 at a time) — see lib/types.ts HistoryPage.
 * `stats` is computed over *every* finalized week regardless of page size,
 * so the Tracker's all-time averages stay correct as more pages load. */
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
  const weeks: WeekSummary[] = page.map((r) => ({
    weekNumber: r.week_number,
    startDateKey: r.start_date,
    total: r.total,
    completed: r.completed,
    percent: r.total === 0 ? 0 : Math.round((r.completed / r.total) * 100),
    finalized: true,
  }));

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
