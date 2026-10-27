import sql from "@/lib/db";
import { NOTE_MAX_LENGTH } from "@/lib/goals";

/**
 * The week note — an optional line about how a finished week went. It lives
 * in its own table so the note can be written without ever touching a week's
 * task rows: history stays frozen, only the commentary on it is editable.
 *
 * A note can be written once and changed once. After that it is final, like
 * the week it belongs to (`edited` records that the one change is used).
 */

export interface WeekNote {
  note: string;
  /** True once the one allowed change has been made. */
  edited: boolean;
}

let ensured: Promise<void> | null = null;

/** Creates week_notes the first time it's needed, once per server instance,
 * and brings an older one up to date (200-character limit, `edited` column).
 * The same table is in schema.sql (section 6) for fresh installs; doing it
 * here too means an already-deployed database picks the feature up the moment
 * the new code runs, with no manual SQL step to forget. Safe to run any number
 * of times. */
export function ensureNotesTable(): Promise<void> {
  if (!ensured) {
    ensured = (async () => {
      await sql.unsafe(`
        create table if not exists week_notes (
          week_id    uuid primary key references weeks(id) on delete cascade,
          note       text not null,
          edited     boolean not null default false,
          updated_at timestamptz not null default now(),
          constraint week_note_len check (char_length(note) between 1 and ${NOTE_MAX_LENGTH})
        )
      `);
      await sql`alter table week_notes add column if not exists edited boolean not null default false`;
      await sql.unsafe(`
        do $$
        begin
          if exists (
            select 1 from pg_constraint
            where conname = 'week_note_len' and conrelid = 'week_notes'::regclass
              and pg_get_constraintdef(oid) not like '%${NOTE_MAX_LENGTH}%'
          ) then
            alter table week_notes drop constraint week_note_len;
            alter table week_notes add constraint week_note_len
              check (char_length(note) between 1 and ${NOTE_MAX_LENGTH});
          end if;
        end $$
      `);
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
 * weeks simply show without notes — a missing note must never take the
 * Records list down with it. */
export async function getNotesFor(weekNumbers: number[]): Promise<Map<number, WeekNote>> {
  const map = new Map<number, WeekNote>();
  if (weekNumbers.length === 0) return map;
  try {
    const min = Math.min(...weekNumbers);
    const max = Math.max(...weekNumbers);
    const rows = await withNotesTable(
      () => sql<{ week_number: number; note: string; edited: boolean }[]>`
        select w.week_number, n.note, n.edited
        from week_notes n join weeks w on w.id = n.week_id
        where w.week_number between ${min} and ${max}
      `
    );
    for (const r of rows) map.set(r.week_number, { note: r.note, edited: r.edited });
  } catch (err) {
    console.error("week_notes unavailable, continuing without notes:", err);
  }
  return map;
}

export async function getNote(weekNumber: number): Promise<WeekNote | null> {
  return (await getNotesFor([weekNumber])).get(weekNumber) ?? null;
}

export type SetNoteResult =
  | { ok: true; note: string; edited: boolean }
  | { ok: false; status: number; error: string };

/**
 * Writes the note for a finished week.
 *  - No note yet: it is added.
 *  - A note, change not used yet: it is replaced, and the change is used up.
 *  - A note already changed once: refused. There is no way to delete a note,
 *    so clearing it can't be used to start over.
 */
export async function setNote(weekNumber: number, raw: string): Promise<SetNoteResult> {
  // One line, tidy spacing — it's shown inline in the Records list.
  const note = raw.replace(/\s+/g, " ").trim();
  if (note === "") return { ok: false, status: 400, error: "Write something first" };
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
    return await withNotesTable(() =>
      sql.begin(async (tx): Promise<SetNoteResult> => {
        const added = await tx<{ note: string }[]>`
          insert into week_notes (week_id, note) values (${week.id}, ${note})
          on conflict (week_id) do nothing returning note
        `;
        if (added.length > 0) return { ok: true, note, edited: false };

        const [cur] = await tx<{ note: string; edited: boolean }[]>`
          select note, edited from week_notes where week_id = ${week.id} for update
        `;
        if (!cur) return { ok: false, status: 409, error: "Try that again" }; // deleted between the two statements
        if (cur.edited) return { ok: false, status: 409, error: "This note is final" };
        if (cur.note === note) return { ok: true, note, edited: false }; // nothing changed: the one change stays unused

        await tx`update week_notes set note = ${note}, edited = true, updated_at = now() where week_id = ${week.id}`;
        return { ok: true, note, edited: true };
      })
    );
  } catch (err) {
    console.error("week_notes could not be written:", err);
    return { ok: false, status: 503, error: "Notes aren't available right now \u2014 try again shortly" };
  }
}
