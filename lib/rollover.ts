import type postgres from "postgres";
import sql from "@/lib/db";
import { getAppWeekStartDateKey, getWeekDateKeys, parseDateKey } from "@/lib/date";
import { sendWeeklySummaryEmail } from "@/lib/email";
import type { FinishedWeekData } from "@/lib/email";
import type { DayIndex } from "@/lib/types";

// sql.begin() hands the callback a TransactionSql, a distinct (larger) type
// from the plain Sql instance in lib/db.ts — createWeek/finalizeWeek only
// ever run inside a transaction, so they're typed against this directly.
type Tx = postgres.TransactionSql;

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
// Only email a week that ended recently. A week finalized while catching up
// after a long absence is backfilled silently instead — a congratulations
// email for a week that ended 3 weeks ago is just noise.
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

interface Settings {
  timezone: string;
  notify_email: string;
  notifications_enabled: boolean;
  paused: boolean;
  pending_action: "pause" | "resume" | null;
}

/** Snapshots the live task_templates into week_tasks for a newly created
 * week. Templates are read as they stand right now — this is the one
 * moment edits made via /manage actually take effect. */
async function createWeek(tx: Tx, weekNumber: number, startDateKey: string): Promise<string> {
  const [week] = await tx<{ id: string }[]>`
    insert into weeks (week_number, start_date) values (${weekNumber}, ${startDateKey})
    returning id
  `;
  if (!week) throw new Error("Failed to create week row");

  const templates = await tx<{ day_index: number; name: string; sort_order: number }[]>`
    select day_index, name, sort_order from task_templates order by day_index, sort_order
  `;
  const dateKeys = getWeekDateKeys(startDateKey);

  for (const [dayIndex, dateKey] of dateKeys.entries()) {
    const dayTemplates = templates.filter((t) => t.day_index === dayIndex);
    for (const t of dayTemplates) {
      await tx`
        insert into week_tasks (week_id, day_index, date, name, sort_order)
        values (${week.id}, ${dayIndex}, ${dateKey}, ${t.name}, ${t.sort_order})
      `;
    }
  }
  return week.id;
}

async function loadFinishedWeekData(weekId: string): Promise<FinishedWeekData | null> {
  const [week] = await sql<{ week_number: number; start_date: string }[]>`
    select week_number, start_date from weeks where id = ${weekId}
  `;
  if (!week) return null;

  const tasks = await sql<
    { day_index: number; date: string; id: string; name: string; completed: boolean }[]
  >`
    select day_index, date, id, name, completed from week_tasks
    where week_id = ${weekId} order by day_index, sort_order
  `;

  const startDateKey = week.start_date;
  const dayIndexes = [0, 1, 2, 3, 4, 5, 6] as DayIndex[];
  const total = tasks.length;
  const completed = tasks.filter((t) => t.completed).length;

  return {
    weekNumber: week.week_number,
    startDateKey,
    endDateKey: addDaysToDateKey(startDateKey, 6),
    total,
    completed,
    percent: total === 0 ? 0 : Math.round((completed / total) * 100),
    days: dayIndexes.map((dayIndex) => {
      const dayTasks = tasks.filter((t) => t.day_index === dayIndex);
      return {
        dayIndex,
        dateKey: dayTasks[0]?.date ?? addDaysToDateKey(startDateKey, dayIndex),
        tasks: dayTasks.map((t) => ({ id: t.id, name: t.name, completed: t.completed })),
      };
    }),
  };
}

/** Emails go out after the owning transaction commits (never while holding
 * a DB lock), and only if this call wins the atomic claim on
 * weeks.emailed_at — belt-and-suspenders against a racing cron and
 * lazy-check both trying to send the same week's email. */
async function claimAndEmail(weekId: string, notifyEmail: string): Promise<void> {
  const claim = await sql<{ id: string }[]>`
    update weeks set emailed_at = now() where id = ${weekId} and emailed_at is null returning id
  `;
  if (claim.length === 0) return;
  const data = await loadFinishedWeekData(weekId);
  if (!data) return;
  const ok = await sendWeeklySummaryEmail(data, notifyEmail);
  if (!ok) {
    // Let a future run retry rather than silently losing the email.
    await sql`update weeks set emailed_at = null where id = ${weekId}`;
  }
}

/**
 * The one function everything else calls before touching week data. Brings
 * the database up to date with "now", handling every gap size and the
 * pause/resume state machine:
 *
 *  - Never run before: creates week 1 (unless already paused with nothing
 *    started yet, in which case there's nothing to do).
 *  - Normal case: finalizes last week, creates this week, emails it.
 *  - Long absence (no pause involved): finalizes and creates every skipped
 *    week in sequence — each honestly 0%, since nothing was tracked —
 *    without emailing any of them (see EMAIL_FRESHNESS_MS).
 *  - Pause takes effect at the *next* boundary after it's requested: the
 *    week that's running finishes and is emailed completely normally, then
 *    no new week is created — the app goes idle.
 *  - Resume also takes effect only at a boundary: it does NOT backfill the
 *    idle weeks (that idle time was deliberate, unlike an accidental
 *    absence) — it jumps straight to creating one fresh week starting at
 *    the real current boundary.
 *  - Concurrent calls: a row-level lock on the latest week serializes them.
 */
export async function ensureCurrentWeek(now: Date): Promise<void> {
  const [settingsRow] = await sql<Settings[]>`
    select timezone, notify_email, notifications_enabled, paused, pending_action
    from user_settings where singleton = true
  `;
  const settings: Settings = settingsRow ?? {
    timezone: "Asia/Dhaka",
    notify_email: "arnabsahawrk@gmail.com",
    notifications_enabled: true,
    paused: false,
    pending_action: null,
  };

  const targetWeekStart = getAppWeekStartDateKey(now, settings.timezone);
  const toEmail: string[] = [];

  await sql.begin(async (tx) => {
    const [latest] = await tx<WeekRow[]>`
      select id, week_number, start_date from weeks order by week_number desc limit 1 for update
    `;

    if (!latest) {
      if (settings.paused) return; // paused before ever starting — nothing to do
      await createWeek(tx, 1, targetWeekStart);
      return;
    }

    let current = latest;
    let iterations = 0;
    while (current.start_date < targetWeekStart) {
      // Safety valve: only trips if something upstream is badly wrong
      // (e.g. a corrupted start_date), never in ordinary use.
      if (++iterations > 5000) throw new Error("ensureCurrentWeek: runaway loop, aborting");

      if (settings.paused) {
        if (settings.pending_action === "resume") {
          const newId = await createWeek(tx, current.week_number + 1, targetWeekStart);
          await tx`update user_settings set paused = false, pending_action = null, updated_at = now() where singleton = true`;
          current = { id: newId, week_number: current.week_number + 1, start_date: targetWeekStart };
        }
        break; // idle (or just resumed straight to "now") — nothing more to walk through
      }

      // Not paused: the week that's running finishes completely normally,
      // pause or no pause — it isn't interrupted.
      await tx`update weeks set finalized = true where id = ${current.id}`;
      const endedAt = new Date(Date.UTC(...parseDateKeyTuple(current.start_date)) + WEEK_MS);
      if (now.getTime() - endedAt.getTime() <= EMAIL_FRESHNESS_MS) toEmail.push(current.id);

      if (settings.pending_action === "pause") {
        await tx`update user_settings set paused = true, pending_action = null, updated_at = now() where singleton = true`;
        break; // this is the boundary pausing takes effect at — stop here
      }

      const nextStart = addDaysToDateKey(current.start_date, 7);
      const nextNumber = current.week_number + 1;
      const nextId = await createWeek(tx, nextNumber, nextStart);
      current = { id: nextId, week_number: nextNumber, start_date: nextStart };
    }
  });

  if (!settings.notifications_enabled) return;
  for (const weekId of toEmail) await claimAndEmail(weekId, settings.notify_email);
}
