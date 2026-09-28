import sql from "@/lib/db";
import type { DayIndex, TaskTemplateItem } from "@/lib/types";

const MAX_NAME_LEN = 60;
const MAX_TASKS_PER_DAY = 16;

export async function listTemplates(): Promise<TaskTemplateItem[]> {
  const rows = await sql<
    { id: string; day_index: number; name: string; emoji: string | null; sort_order: number }[]
  >`
    select id, day_index, name, emoji, sort_order from task_templates order by day_index, sort_order
  `;
  return rows.map((r) => ({
    id: r.id,
    dayIndex: r.day_index as DayIndex,
    name: r.name,
    emoji: r.emoji ?? undefined,
    sortOrder: r.sort_order,
  }));
}

export type AddResult = { ok: true; id: string } | { ok: false; error: string };

/** Adding here never touches the week that's currently running — only the
 * next rollover reads this table (see lib/rollover.ts createWeek). */
export async function addTemplateTask(
  dayIndex: DayIndex,
  name: string,
  emoji: string | undefined
): Promise<AddResult> {
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
  const next = nextRow?.next ?? 0;
  const [row] = await sql<{ id: string }[]>`
    insert into task_templates (day_index, name, emoji, sort_order)
    values (${dayIndex}, ${trimmed}, ${emoji ?? null}, ${next})
    returning id
  `;
  if (!row) return { ok: false, error: "Insert failed" };
  return { ok: true, id: row.id };
}

export async function removeTemplateTask(id: string): Promise<void> {
  await sql`delete from task_templates where id = ${id}`;
}

export async function renameTemplateTask(
  id: string,
  name: string,
  emoji: string | undefined
): Promise<AddResult> {
  const trimmed = name.trim();
  if (trimmed.length < 1 || trimmed.length > MAX_NAME_LEN) {
    return { ok: false, error: `Name must be 1–${MAX_NAME_LEN} characters` };
  }
  await sql`update task_templates set name = ${trimmed}, emoji = ${emoji ?? null} where id = ${id}`;
  return { ok: true, id };
}
