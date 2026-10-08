import sql from "@/lib/db";
import { addDaysToDateKey, getAppDateKey } from "@/lib/date";
import { TASK_WINDOW_WEEKS } from "@/lib/goals";
import { computeInsights } from "@/lib/insights";
import type { DayRow, Insights, TaskRow, TickRow } from "@/lib/insights";

/** Feeds lib/insights.ts. Everything is aggregated by the database so only
 * a few hundred small rows ever cross the wire, however long the history
 * gets: one row per day with tasks, one per task name, one per recent tick.
 * Nothing here is stored or cached — it is recomputed on every request. */
export async function getInsights(now: Date): Promise<Insights> {
  const [settings] = await sql<{ timezone: string }[]>`
    select timezone from user_settings where singleton = true
  `;
  const timeZone = settings?.timezone ?? "Asia/Dhaka";
  const todayKey = getAppDateKey(now, timeZone);
  // "Recently" = the last 8 weeks of calendar days, closed days only for the
  // per-task rates so unticked future days never look like misses.
  const windowStart = addDaysToDateKey(todayKey, -TASK_WINDOW_WEEKS * 7);

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
    sql<{ name: string; total: number; done: number }[]>`
      select name, count(*)::int as total, count(*) filter (where completed)::int as done
      from week_tasks
      where date < ${todayKey} and date >= ${windowStart}
      group by name
    `,
    sql<{ date: string; completed_at: Date }[]>`
      select date, completed_at from week_tasks
      where completed and completed_at is not null
        and date >= ${windowStart} and date <= ${todayKey}
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
