import sql from "@/lib/db";
import { cleanTaskName, taskKey } from "@/lib/task-name";

/**
 * Two tables hold the plan for the weeks to come:
 *
 *   tasks           the list — every task, named once (`name_key` makes two
 *                   spellings of the same name impossible), in the order the
 *                   list shows them.
 *   task_templates  which task is on which day, and where in that day's order.
 *
 * Until the list existed, `task_templates` held one row per day *and name*
 * (`id, day_index, name, sort_order`), so the same task typed on three days was
 * three unrelated rows and a stray hyphen made a different task. This file
 * moves an existing database to the new layout the first time it is needed —
 * the same "nothing for you to run" approach as lib/notes.ts. A fresh
 * database already has the new layout (schema.sql), so this does nothing.
 *
 * The upgrade runs in one transaction under an advisory lock, so two server
 * instances starting together can't both do it, and a failure leaves the old
 * tables exactly as they were. Weeks that already exist are never touched:
 * they hold their own copy of every name.
 */

type Db = typeof sql;
type Layout = "missing" | "old" | "current";

let ensured: Promise<void> | null = null;

/** Call before reading or writing the plan. Cheap after the first time. */
export function ensureTaskLibrary(): Promise<void> {
  if (!ensured) {
    ensured = upgrade().catch((err) => {
      ensured = null; // let the next call try again
      throw err;
    });
  }
  return ensured;
}

async function layoutOf(db: Db): Promise<Layout> {
  const cols = await db<{ column_name: string }[]>`
    select column_name from information_schema.columns
    where table_schema = current_schema() and table_name = 'task_templates'
  `;
  if (cols.length === 0) return "missing";
  return cols.some((c) => c.column_name === "task_id") ? "current" : "old";
}

async function upgrade(): Promise<void> {
  if ((await layoutOf(sql)) === "current") return;

  await sql.begin(async (tx) => {
    // Whoever gets here first upgrades; anyone else waits, then sees it done.
    await tx`select pg_advisory_xact_lock(7270101)`;
    // A transaction is the same thing for querying; the types just don't say so.
    const layout = await layoutOf(tx as unknown as Db);
    if (layout === "current") return;

    // Read the old plan before its table goes.
    const old =
      layout === "old"
        ? await tx<{ day_index: number; name: string }[]>`
            select day_index, name from task_templates order by day_index, sort_order, id
          `
        : [];
    if (layout === "old") await tx`drop table task_templates`;

    await tx`
      create table if not exists tasks (
        id          uuid primary key default gen_random_uuid(),
        name        text not null,
        name_key    text not null,
        sort_order  integer not null default 0,
        created_at  timestamptz not null default now(),
        constraint task_name_len check (char_length(name) between 1 and 60),
        constraint tasks_name_key_unique unique (name_key)
      )
    `;
    await tx`
      create table task_templates (
        task_id     uuid not null references tasks(id) on delete cascade,
        day_index   smallint not null,
        sort_order  integer not null default 0,
        primary key (task_id, day_index),
        constraint task_day_index_range check (day_index between 0 and 6)
      )
    `;
    await tx`create index if not exists task_templates_day_idx on task_templates(day_index, sort_order)`;

    // One task per distinct name. Spellings that only differ by case, spacing
    // or punctuation ("Work" / "Work-") become one task under the spelling
    // met first; a day that had both keeps a single slot.
    const list = new Map<string, string>(); // key -> name, in the order first met
    const perDay: string[][] = [[], [], [], [], [], [], []]; // keys, in each day's order
    for (const row of old) {
      const name = cleanTaskName(row.name);
      if (!name) continue;
      const key = taskKey(name);
      if (!list.has(key)) list.set(key, name);
      const day = perDay[row.day_index];
      if (day && !day.includes(key)) day.push(key);
    }

    const ids = new Map<string, string>();
    let order = 0;
    for (const [key, name] of list) {
      const [row] = await tx<{ id: string }[]>`
        insert into tasks (name, name_key, sort_order)
        values (${name.slice(0, 60)}, ${key}, ${order++})
        on conflict (name_key) do update set name_key = tasks.name_key
        returning id
      `;
      if (row) ids.set(key, row.id);
    }
    for (const [dayIndex, keys] of perDay.entries()) {
      for (const [position, key] of keys.entries()) {
        const taskId = ids.get(key);
        if (!taskId) continue;
        await tx`
          insert into task_templates (task_id, day_index, sort_order)
          values (${taskId}, ${dayIndex}, ${position})
        `;
      }
    }
  });
}
