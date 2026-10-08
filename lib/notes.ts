import sql from "@/lib/db";
import { NOTE_MAX_LENGTH } from "@/lib/goals";

/**
 * "What got in the way?" — an optional one-line reflection on a finished
 * week. It lives in its own table so the note can be written (and removed)
 * without ever touching a week's task rows: history stays frozen, only the
 * commentary on it is editable.
 */

let ensured: Promise<void> | null = null;

/** Creates week_notes the first time it's needed, once per server instance.
 * The same statement is in schema.sql (section 6) for fresh installs; doing
 * it here too means an already-deployed database picks the feature up the
 * moment the new code runs, with no manual SQL step to forget. Safe to run
 * any number of times. */
export function ensureNotesTable(): Promise<void> {
  if (!ensured) {
    ensured = (async () => {
      await sql`
        create table if not exists week_notes (
          week_id    uuid primary key references weeks(id) on delete cascade,
          note       text not null,
          updated_at timestamptz not null default now(),
          constraint week_note_len check (char_length(note) between 1 and 160)
        )
      `;
    })().catch((err) => {
      ensured = null; // let the next call try again
      throw err;
    });
  }
  return ensured;
}

/** Runs a notes query with the table guaranteed to exist. If the table has
 * gone missing since it was last checked (dropped by hand, restored from an
 * older backup...) it is recreated and the query tried once more. */
async function withNotesTable<T>(run: () => Promise<T>): Promise<T> {
  await ensureNotesTable();
  try {
    return await run();
  } catch (err) {
    if ((err as { code?: string } | null)?.code !== "42P01") throw err; // undefined_table
    ensured = null;
    await ensureNotesTable();
    return run();
  }
}

/** Notes for a set of weeks. Never throws: if the table can't be reached the
 * weeks simply show without notes — a missing reflection must never take the
 * Records list down with it. */
export async function getNotesFor(weekNumbers: number[]): Promise<Map<number, string>> {
  const map = new Map<number, string>();
  if (weekNumbers.length === 0) return map;
  try {
    const min = Math.min(...weekNumbers);
    const max = Math.max(...weekNumbers);
    const rows = await withNotesTable(
      () => sql<{ week_number: number; note: string }[]>`
        select w.week_number, n.note
        from week_notes n join weeks w on w.id = n.week_id
        where w.week_number between ${min} and ${max}
      `
    );
    for (const r of rows) map.set(r.week_number, r.note);
  } catch (err) {
    console.error("week_notes unavailable, continuing without notes:", err);
  }
  return map;
}

export async function getNote(weekNumber: number): Promise<string | null> {
  return (await getNotesFor([weekNumber])).get(weekNumber) ?? null;
}

export type SetNoteResult =
  | { ok: true; note: string | null }
  | { ok: false; status: number; error: string };

/** Saves (or, when empty, removes) the note for a finished week. */
export async function setNote(weekNumber: number, raw: string): Promise<SetNoteResult> {
  // One line, tidy spacing — it's shown inline in the Records list.
  const note = raw.replace(/\s+/g, " ").trim();
  if (note.length > NOTE_MAX_LENGTH) {
    return { ok: false, status: 400, error: `Keep it to ${NOTE_MAX_LENGTH} characters or fewer` };
  }

  const [week] = await sql<{ id: string; finalized: boolean }[]>`
    select id, finalized from weeks where week_number = ${weekNumber}
  `;
  if (!week) return { ok: false, status: 404, error: "No such week" };
  if (!week.finalized) {
    return { ok: false, status: 409, error: "A note can be added once the week has finished" };
  }

  try {
    if (note === "") {
      await withNotesTable(() => sql`delete from week_notes where week_id = ${week.id}`);
      return { ok: true, note: null };
    }
    await withNotesTable(
      () => sql`
        insert into week_notes (week_id, note) values (${week.id}, ${note})
        on conflict (week_id) do update set note = excluded.note, updated_at = now()
      `
    );
    return { ok: true, note };
  } catch (err) {
    console.error("week_notes could not be written:", err);
    return { ok: false, status: 503, error: "Notes aren't available right now — try again shortly" };
  }
}
