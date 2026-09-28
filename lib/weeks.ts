import sql from "@/lib/db";
import { ensureCurrentWeek } from "@/lib/rollover";
import { getAppDateKey } from "@/lib/date";
import type { CurrentWeek, DayEntry, DayIndex, WeekSummary } from "@/lib/types";

/** Always call this before reading/writing week data — it's what makes the
 * rollover happen "automatically": no cron has to have run yet, this call
 * itself brings the database up to date with `now` if it's behind. */
export async function getCurrentWeek(now: Date): Promise<CurrentWeek> {
  await ensureCurrentWeek(now);

  const [week] = await sql<
    { id: string; week_number: number; start_date: string; total_tasks: number; completed_tasks: number; percent: number }[]
  >`
    select id, week_number, start_date, total_tasks, completed_tasks, percent
    from weeks order by week_number desc limit 1
  `;
  if (!week) throw new Error("getCurrentWeek: no week exists after ensureCurrentWeek");

  const days = await sql<{ day_index: number; date: string }[]>`
    select day_index, date from week_days where week_id = ${week.id} order by day_index
  `;
  const tasks = await sql<
    { day_index: number; id: string; name: string; emoji: string | null; completed: boolean }[]
  >`
    select wd.day_index, wdt.id, wdt.name, wdt.emoji, wdt.completed
    from week_day_tasks wdt
    join week_days wd on wd.id = wdt.week_day_id
    where wd.week_id = ${week.id}
    order by wd.day_index, wdt.sort_order
  `;

  const dayEntries: DayEntry[] = days.map((d) => ({
    dayIndex: d.day_index as DayIndex,
    dateKey: d.date,
    tasks: tasks
      .filter((t) => t.day_index === d.day_index)
      .map((t) => ({ id: t.id, name: t.name, emoji: t.emoji ?? undefined, completed: t.completed })),
  }));

  return {
    weekNumber: week.week_number,
    startDateKey: week.start_date,
    completed: week.completed_tasks,
    total: week.total_tasks,
    percent: week.percent,
    finalized: false,
    days: dayEntries,
  };
}

export type ToggleResult = "ok" | "not-found" | "locked";

/** Flips one task and keeps the parent week's cached counters in sync.
 * Enforced here, not just in the UI: a task can only be toggled if it
 * belongs to *today's* week_day (per the 6am rule), so a direct API call
 * can't back-date or future-date a tick any more than the UI can. */
export async function toggleTask(taskId: string, now: Date, timeZone: string): Promise<ToggleResult> {
  const todayKey = getAppDateKey(now, timeZone);

  return sql.begin(async (tx) => {
    const [target] = await tx<{ week_id: string; date: string }[]>`
      select wd.week_id as week_id, wd.date as date
      from week_day_tasks wdt
      join week_days wd on wd.id = wdt.week_day_id
      where wdt.id = ${taskId}
    `;
    if (!target) return "not-found" as const;
    if (String(target.date) !== todayKey) return "locked" as const;

    await tx`
      update week_day_tasks
      set completed = not completed,
          completed_at = case when not completed then now() else null end
      where id = ${taskId}
    `;

    const [stats] = await tx<{ total: number; completed: number }[]>`
      select count(*)::int as total, count(*) filter (where wdt.completed)::int as completed
      from week_day_tasks wdt
      join week_days wd on wd.id = wdt.week_day_id
      where wd.week_id = ${target.week_id}
    `;
    const total = stats?.total ?? 0;
    const completed = stats?.completed ?? 0;
    const percent = total === 0 ? 0 : Math.round((completed / total) * 100);
    await tx`
      update weeks set total_tasks = ${total}, completed_tasks = ${completed}, percent = ${percent}
      where id = ${target.week_id}
    `;
    return "ok" as const;
  });
}

export async function getHistory(limit = 26): Promise<WeekSummary[]> {
  const rows = await sql<
    { week_number: number; start_date: string; total_tasks: number; completed_tasks: number; percent: number }[]
  >`
    select week_number, start_date, total_tasks, completed_tasks, percent
    from weeks where finalized = true
    order by week_number desc limit ${limit}
  `;
  return rows.map((r) => ({
    weekNumber: r.week_number,
    startDateKey: r.start_date,
    total: r.total_tasks,
    completed: r.completed_tasks,
    percent: r.percent,
    finalized: true,
  }));
}
