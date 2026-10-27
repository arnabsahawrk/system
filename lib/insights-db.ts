import sql from "@/lib/db";
import { getAppDateKey } from "@/lib/date";
import { computeInsights } from "@/lib/insights";
import type { DayRow, Insights, TaskRow, TickRow } from "@/lib/insights";

/** Feeds lib/insights.ts. The days and the tasks are aggregated by the
 * database, so a few hundred small rows cross the wire however long the
 * history gets: one row per day with tasks, one per task name. The ticks are
 * one tiny row each (a date and a time), which stays small for years of use.
 * Everything is recomputed on every request — nothing is stored or cached. */
export async function getInsights(now: Date): Promise<Insights> {
  const [settings] = await sql<{ timezone: string }[]>`
    select timezone from user_settings where singleton = true
  `;
  const timeZone = settings?.timezone ?? "Asia/Dhaka";
  const todayKey = getAppDateKey(now, timeZone);

  const [dayRows, taskRows, tickRows] = await Promise.all([
    sql<
      { date: string; day_index: number; week_number: number; finalized: boolean; total: number; done: number }[]
    >`
      select wt.date, wt.day_index, w.week_number, w.finalized,
        count(*)::int as total, count(*) filter (where wt.completed)::int as done
      from week_tasks wt join weeks w on w.id = wt.week_id
      group by wt.date, wt.day_index, w.week_number, w.finalized
      order by wt.date
    `,
    // Closed days only, so a task that hasn't had its turn yet never looks missed.
    sql<{ name: string; total: number; done: number }[]>`
      select name, count(*)::int as total, count(*) filter (where completed)::int as done
      from week_tasks
      where date < ${todayKey}
      group by name
    `,
    sql<{ date: string; completed_at: Date }[]>`
      select date, completed_at from week_tasks
      where completed and completed_at is not null and date <= ${todayKey}
    `,
  ]);

  const days: DayRow[] = dayRows.map((r) => ({
    date: r.date,
    dayIndex: r.day_index,
    weekNumber: r.week_number,
    finalized: r.finalized,
    total: r.total,
    done: r.done,
  }));
  const tasks: TaskRow[] = taskRows.map((r) => ({ name: r.name, total: r.total, done: r.done }));
  const ticks: TickRow[] = tickRows.map((r) => ({ date: r.date, completedAt: r.completed_at }));

  return computeInsights({ todayKey, timeZone, days, tasks, ticks });
}
