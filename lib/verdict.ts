import sql from "@/lib/db";
import { addDaysToDateKey } from "@/lib/date";
import { TARGET_PERCENT, TASK_WINDOW_WEEKS } from "@/lib/goals";
import { getNote } from "@/lib/notes";
import { percentOf, rankTasks, weekStreakEndingAt } from "@/lib/stats";
import type { DayIndex, DayStat, Verdict } from "@/lib/types";

/** What a finished week looked like next to the ones around it: change since
 * the week before, the run of on-target weeks it belongs to, and the task
 * that has been slipping. Feeds the week-closed sheet and the weekly email.
 * Returns null for a week that doesn't exist or hasn't finished yet. */
export async function getWeekVerdict(weekNumber: number): Promise<Verdict | null> {
  const [week] = await sql<{ id: string; week_number: number; start_date: string; finalized: boolean }[]>`
    select id, week_number, start_date, finalized from weeks where week_number = ${weekNumber}
  `;
  if (!week || !week.finalized) return null;

  const firstWeekOfWindow = weekNumber - (TASK_WINDOW_WEEKS - 1);

  const [dayRows, weekRows, taskRows, note] = await Promise.all([
    sql<{ day_index: number; total: number; done: number }[]>`
      select day_index, count(*)::int as total, count(*) filter (where completed)::int as done
      from week_tasks where week_id = ${week.id} group by day_index
    `,
    // Recent finished weeks up to and including this one — enough to measure
    // any streak a person is realistically on, newest first.
    sql<{ week_number: number; total: number; done: number }[]>`
      select w.week_number, count(wt.id)::int as total, count(wt.id) filter (where wt.completed)::int as done
      from weeks w left join week_tasks wt on wt.week_id = w.id
      where w.finalized = true and w.week_number <= ${weekNumber}
      group by w.id order by w.week_number desc limit 200
    `,
    sql<{ name: string; total: number; done: number }[]>`
      select wt.name, count(*)::int as total, count(*) filter (where wt.completed)::int as done
      from week_tasks wt join weeks w on w.id = wt.week_id
      where w.finalized = true and w.week_number between ${firstWeekOfWindow} and ${weekNumber}
      group by wt.name
    `,
    getNote(weekNumber),
  ]);

  const dayStats: DayStat[] = ([0, 1, 2, 3, 4, 5, 6] as DayIndex[]).map((i) => {
    const hit = dayRows.find((r) => r.day_index === i);
    return { done: hit?.done ?? 0, total: hit?.total ?? 0 };
  });
  const total = dayStats.reduce((n, d) => n + d.total, 0);
  const completed = dayStats.reduce((n, d) => n + d.done, 0);
  const percent = percentOf(completed, total);

  const weeks = weekRows.map((r) => ({
    weekNumber: r.week_number,
    total: r.total,
    percent: percentOf(r.done, r.total),
  }));
  const prev = weeks.find((w) => w.weekNumber === weekNumber - 1 && w.total > 0) ?? null;

  const weakest = rankTasks(taskRows)[0] ?? null;

  return {
    weekNumber,
    startDateKey: week.start_date,
    endDateKey: addDaysToDateKey(week.start_date, 6),
    completed,
    total,
    percent,
    dayStats,
    prevWeek: prev ? { weekNumber: prev.weekNumber, percent: prev.percent } : null,
    delta: prev ? percent - prev.percent : null,
    weekStreak: weekStreakEndingAt(weeks, weekNumber, TARGET_PERCENT),
    perfectDays: dayStats.filter((d) => d.total > 0 && d.done === d.total).length,
    weakestTask: weakest
      ? { name: weakest.name, percent: weakest.percent, done: weakest.done, total: weakest.total }
      : null,
    note,
  };
}
