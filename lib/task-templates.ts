import sql from "@/lib/db";
import type { DayIndex, TaskTemplateItem } from "@/lib/types";

const MAX_NAME_LEN = 60;
const MAX_TASKS_PER_DAY = 16;

export async function listTemplates(): Promise<TaskTemplateItem[]> {
  const rows = await sql<{ id: string; day_index: number; name: string; sort_order: number }[]>`
    select id, day_index, name, sort_order from task_templates order by day_index, sort_order
  `;
  return rows.map((r) => ({
    id: r.id,
    dayIndex: r.day_index as DayIndex,
    name: r.name,
    sortOrder: r.sort_order,
  }));
}

export type Result = { ok: true } | { ok: false; error: string };

/** Adding/removing/reordering here never touches the week that's currently
 * running — only the next rollover reads this table (see
 * lib/rollover.ts createWeek). */
export async function addTemplateTask(dayIndex: DayIndex, name: string): Promise<Result & { id?: string }> {
  const trimmed = name.trim();
  if (trimmed.length < 1 || trimmed.length > MAX_NAME_LEN) {
    return { ok: false, error: `Name must be 1–${MAX_NAME_LEN} characters` };
  }
  const [countRow] = await sql<{ count: number }[]>`
    select count(*)::int as count from task_templates where day_index = ${dayIndex}
  `;
  if ((countRow?.count ?? 0) >= MAX_TASKS_PER_DAY) {
    return { ok: false, error: `Max ${MAX_TASKS_PER_DAY} tasks per day` };
  }
  const [nextRow] = await sql<{ next: number }[]>`
    select coalesce(max(sort_order), -1) + 1 as next from task_templates where day_index = ${dayIndex}
  `;
  const [row] = await sql<{ id: string }[]>`
    insert into task_templates (day_index, name, sort_order)
    values (${dayIndex}, ${trimmed}, ${nextRow?.next ?? 0})
    returning id
  `;
  if (!row) return { ok: false, error: "Insert failed" };
  return { ok: true, id: row.id };
}

export async function removeTemplateTask(id: string): Promise<void> {
  await sql`delete from task_templates where id = ${id}`;
}

export async function renameTemplateTask(id: string, name: string): Promise<Result> {
  const trimmed = name.trim();
  if (trimmed.length < 1 || trimmed.length > MAX_NAME_LEN) {
    return { ok: false, error: `Name must be 1–${MAX_NAME_LEN} characters` };
  }
  await sql`update task_templates set name = ${trimmed} where id = ${id}`;
  return { ok: true };
}

/** Persists a full new order for one day's tasks (drag-and-drop / move
 * up-down in /manage) — `orderedIds` must be every task id for that day. */
export async function reorderTemplateTasks(dayIndex: DayIndex, orderedIds: string[]): Promise<Result> {
  await sql.begin(async (tx) => {
    for (let i = 0; i < orderedIds.length; i++) {
      await tx`
        update task_templates set sort_order = ${i}
        where id = ${orderedIds[i]!} and day_index = ${dayIndex}
      `;
    }
  });
  return { ok: true };
}
