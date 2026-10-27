import sql from "@/lib/db";
import { addDaysToDateKey } from "@/lib/date";
import { getNote } from "@/lib/notes";
import { percentOf, rankTasks } from "@/lib/stats";
import type { DayIndex, DayStat, Verdict } from "@/lib/types";

/** What a finished week looked like next to the ones before it: the change
 * since the week before, whether it beat every earlier week, and the task that
 * has slipped most overall. Feeds the week-closed sheet and the weekly email.
 * Returns null for a week that doesn't exist or hasn't finished yet. */
export async function getWeekVerdict(weekNumber: number): Promise<Verdict | null> {
  const [week] = await sql<{ id: string; week_number: number; start_date: string; finalized: boolean }[]>`
    select id, week_number, start_date, finalized from weeks where week_number = ${weekNumber}
  `;
  if (!week || !week.finalized) return null;

  const [dayRows, weekRows, taskRows, saved] = await Promise.all([
    sql<{ day_index: number; total: number; done: number }[]>`
      select day_index, count(*)::int as total, count(*) filter (where completed)::int as done
      from week_tasks where week_id = ${week.id} group by day_index
    `,
    // Every finished week up to and including this one (a few numbers each).
    sql<{ week_number: number; total: number; done: number }[]>`
      select w.week_number, count(wt.id)::int as total, count(wt.id) filter (where wt.completed)::int as done
      from weeks w left join week_tasks wt on wt.week_id = w.id
      where w.finalized = true and w.week_number <= ${weekNumber}
      group by w.id order by w.week_number desc
    `,
    sql<{ name: string; total: number; done: number }[]>`
      select wt.name, count(*)::int as total, count(*) filter (where wt.completed)::int as done
      from week_tasks wt join weeks w on w.id = wt.week_id
      where w.finalized = true and w.week_number <= ${weekNumber}
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
  const earlier = weeks.filter((w) => w.weekNumber < weekNumber && w.total > 0);
  const bestWeek = total > 0 && earlier.length > 0 && percent > Math.max(...earlier.map((w) => w.percent));

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
    bestWeek,
    perfectDays: dayStats.filter((d) => d.total > 0 && d.done === d.total).length,
    weakestTask: weakest
      ? { name: weakest.name, percent: weakest.percent, done: weakest.done, total: weakest.total }
      : null,
    note: saved?.note ?? null,
    noteEdited: saved?.edited ?? false,
  };
}
