import type postgres from "postgres";
import sql from "@/lib/db";
import { getAppWeekStartDateKey, getWeekDateKeys, parseDateKey } from "@/lib/date";
import { sendWeeklySummaryEmail } from "@/lib/email";
import type { FinishedWeekData } from "@/lib/email";
import { DAY_LABELS } from "@/lib/types";
import type { DayIndex } from "@/lib/types";

// sql.begin() hands the callback a TransactionSql, a distinct (larger) type
// from the plain Sql instance in lib/db.ts — createWeek/finalizeWeek only
// ever run inside a transaction, so they're typed against this directly.
type Tx = postgres.TransactionSql;

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
// Only email a week that ended recently. A week finalized while catching up
// after a long absence (see below) is backfilled silently instead — a
// congratulations email for a week that ended 3 weeks ago is just noise.
const EMAIL_FRESHNESS_MS = 48 * 60 * 60 * 1000;

function addDaysToDateKey(dateKey: string, days: number): string {
  const { year, month, day } = parseDateKey(dateKey);
  const d = new Date(Date.UTC(year, month - 1, day) + days * 86400000);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(
    d.getUTCDate()
  ).padStart(2, "0")}`;
}

function parseDateKeyTuple(dateKey: string): [number, number, number] {
  const { year, month, day } = parseDateKey(dateKey);
  return [year, month - 1, day];
}

interface WeekRow {
  id: string;
  week_number: number;
  start_date: string;
}

/** Snapshots the live task_templates into week_days/week_day_tasks for a
 * newly created week. Templates are read as they stand right now — this is
 * the one moment edits made via /manage actually take effect. */
async function createWeek(tx: Tx, weekNumber: number, startDateKey: string): Promise<string> {
  const [week] = await tx<{ id: string }[]>`
    insert into weeks (week_number, start_date) values (${weekNumber}, ${startDateKey})
    returning id
  `;
  if (!week) throw new Error("Failed to create week row");

  const templates = await tx<
    { day_index: number; name: string; emoji: string | null; sort_order: number }[]
  >`
    select day_index, name, emoji, sort_order from task_templates order by day_index, sort_order
  `;
  const dateKeys = getWeekDateKeys(startDateKey);

  for (const [dayIndex, dateKey] of dateKeys.entries()) {
    const [weekDay] = await tx<{ id: string }[]>`
      insert into week_days (week_id, day_index, date)
      values (${week.id}, ${dayIndex}, ${dateKey})
      returning id
    `;
    if (!weekDay) continue;
    const dayTemplates = templates.filter((t) => t.day_index === dayIndex);
    for (const t of dayTemplates) {
      await tx`
        insert into week_day_tasks (week_day_id, name, emoji, sort_order)
        values (${weekDay.id}, ${t.name}, ${t.emoji}, ${t.sort_order})
      `;
    }
  }

  await tx`update weeks set total_tasks = ${templates.length} where id = ${week.id}`;
  return week.id;
}

/** Recomputes a week's totals from its actual task rows — the source of
 * truth at finalize time, rather than trusting a counter that could have
 * drifted from a partial write. */
async function finalizeWeek(tx: Tx, weekId: string): Promise<void> {
  const [stats] = await tx<{ total: number; completed: number }[]>`
    select
      count(*)::int as total,
      count(*) filter (where wdt.completed)::int as completed
    from week_day_tasks wdt
    join week_days wd on wd.id = wdt.week_day_id
    where wd.week_id = ${weekId}
  `;
  const total = stats?.total ?? 0;
  const completed = stats?.completed ?? 0;
  const percent = total === 0 ? 0 : Math.round((completed / total) * 100);
  await tx`
    update weeks
    set finalized = true, total_tasks = ${total}, completed_tasks = ${completed},
        percent = ${percent}, updated_at = now()
    where id = ${weekId}
  `;
}

async function loadFinishedWeekData(weekId: string): Promise<FinishedWeekData | null> {
  const [week] = await sql<
    { week_number: number; start_date: string; total_tasks: number; completed_tasks: number; percent: number }[]
  >`
    select week_number, start_date, total_tasks, completed_tasks, percent from weeks where id = ${weekId}
  `;
  if (!week) return null;

  const days = await sql<{ day_index: number; date: string }[]>`
    select day_index, date from week_days where week_id = ${weekId} order by day_index
  `;
  const tasks = await sql<
    { day_index: number; id: string; name: string; emoji: string | null; completed: boolean }[]
  >`
    select wd.day_index, wdt.id, wdt.name, wdt.emoji, wdt.completed
    from week_day_tasks wdt
    join week_days wd on wd.id = wdt.week_day_id
    where wd.week_id = ${weekId}
    order by wd.day_index, wdt.sort_order
  `;

  const startDateKey = String(week.start_date);
  return {
    weekNumber: week.week_number,
    startDateKey,
    endDateKey: addDaysToDateKey(startDateKey, 6),
    total: week.total_tasks,
    completed: week.completed_tasks,
    percent: week.percent,
    days: days.map((d) => ({
      dayIndex: d.day_index as DayIndex,
      dateKey: d.date,
      tasks: tasks
        .filter((t) => t.day_index === d.day_index)
        .map((t) => ({ id: t.id, name: t.name, emoji: t.emoji ?? undefined, completed: t.completed })),
    })),
  };
}

/**
 * The one function everything else calls before touching week data. Brings
 * the database up to date with "now", handling every gap size:
 *
 *  - Never run before: creates week 1.
 *  - Normal case (checked within a day or two of the boundary): finalizes
 *    last week, creates this week, sends the summary email.
 *  - Long absence (app not opened for N weeks): finalizes and creates every
 *    skipped week in sequence — each honestly 0%, since nothing was tracked
 *    — without emailing about any of them (see EMAIL_FRESHNESS_MS). Also
 *    the reason "Week 12" always means 12 real elapsed weeks, not 12 weeks
 *    of actual use.
 *  - Concurrent calls (two requests land right at the boundary): a
 *    row-level lock on the latest week serializes them, so only one
 *    finalizes/creates/emails; the loser just sees the already-current week.
 *
 * A caveat worth stating rather than hiding: a skipped week's tasks are
 * snapshotted from *today's* templates, since there is no history of what
 * the template looked like on a past date. If the task list changed during
 * a multi-week gap, backfilled weeks reflect the current list, not
 * whatever was live at the time.
 */
export async function ensureCurrentWeek(now: Date): Promise<void> {
  const [settingsRow] = await sql<{ timezone: string; notify_email: string }[]>`
    select timezone, notify_email from user_settings where singleton = true
  `;
  const settings = settingsRow ?? { timezone: "Asia/Dhaka", notify_email: "arnabsahawrk@gmail.com" };

  const targetWeekStart = getAppWeekStartDateKey(now, settings.timezone);
  const toEmail: string[] = [];

  await sql.begin(async (tx) => {
    const [latest] = await tx<WeekRow[]>`
      select id, week_number, start_date from weeks order by week_number desc limit 1 for update
    `;

    if (!latest) {
      await createWeek(tx, 1, targetWeekStart);
      return;
    }

    let current = latest;
    let iterations = 0;
    while (String(current.start_date) < targetWeekStart) {
      // Safety valve: this only trips if something upstream is badly wrong
      // (e.g. a corrupted start_date), never in ordinary use.
      if (++iterations > 5000) throw new Error("ensureCurrentWeek: runaway loop, aborting");

      await finalizeWeek(tx, current.id);

      const endedAt = new Date(Date.UTC(...parseDateKeyTuple(String(current.start_date))) + WEEK_MS);
      if (now.getTime() - endedAt.getTime() <= EMAIL_FRESHNESS_MS) {
        toEmail.push(current.id);
      }

      const nextStart = addDaysToDateKey(String(current.start_date), 7);
      const nextNumber = current.week_number + 1;
      const nextId = await createWeek(tx, nextNumber, nextStart);
      current = { id: nextId, week_number: nextNumber, start_date: nextStart };
    }
  });

  // Emails go out after the transaction commits, and only if this call wins
  // the claim in rollover_log — belt-and-suspenders against a racing cron
  // and lazy-check both trying to send the same week's email.
  for (const weekId of toEmail) {
    const claim = await sql<{ week_id: string }[]>`
      insert into rollover_log (week_id) values (${weekId}) on conflict do nothing returning week_id
    `;
    if (claim.length === 0) continue;
    const data = await loadFinishedWeekData(weekId);
    if (!data) continue;
    const ok = await sendWeeklySummaryEmail(data, settings.notify_email);
    if (!ok) {
      // Let a future run retry rather than silently losing the email.
      await sql`delete from rollover_log where week_id = ${weekId}`;
    }
  }
}

// Re-exported so callers that only need the day labels don't need a second
// import from lib/types.
export { DAY_LABELS };
