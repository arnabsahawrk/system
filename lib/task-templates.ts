import sql from "@/lib/db";
import { ensureTaskLibrary } from "@/lib/task-library";
import {
  MAX_LIBRARY_TASKS,
  MAX_NAME_LEN,
  MAX_TASKS_PER_DAY,
  cleanTaskName,
  mergeOrder,
  taskKey,
} from "@/lib/task-name";
import { DAY_LABELS } from "@/lib/types";
import type { DayIndex, PlanTask, TaskPlan } from "@/lib/types";

/**
 * The plan for the weeks to come. Nothing here touches the week that is
 * running — only the next rollover reads these tables (lib/rollover.ts
 * createWeek), which is what makes "changes apply at the next reset" true.
 *
 * A task is created once, in the list, and then switched on for the days it
 * belongs to. It exists on a day only through a `task_templates` row, so
 * switching a day off and deleting the task from the list are two sides of
 * the same data, and a name can't drift between days.
 */

export interface Failure {
  ok: false;
  status: number;
  error: string;
}

const isDay = (d: number): d is DayIndex => Number.isInteger(d) && d >= 0 && d <= 6;

class DayFull extends Error {
  day: number;
  constructor(day: number) {
    super("day is full");
    this.day = day;
  }
}

/** The list in its order, and each day's task ids in that day's order. */
export async function getPlan(): Promise<TaskPlan> {
  await ensureTaskLibrary();
  const [tasks, slots] = await Promise.all([
    sql<PlanTask[]>`select id, name from tasks order by sort_order, created_at, id`,
    sql<{ task_id: string; day_index: number }[]>`
      select task_id, day_index from task_templates order by day_index, sort_order, task_id
    `,
  ]);
  const schedule: string[][] = [[], [], [], [], [], [], []];
  for (const s of slots) schedule[s.day_index]?.push(s.task_id);
  return { tasks: tasks.map((t) => ({ id: t.id, name: t.name })), schedule };
}

/** Adds a task to the end of the list. It is on no day until one is switched on. */
export async function addTask(raw: string): Promise<{ ok: true; task: PlanTask } | Failure> {
  await ensureTaskLibrary();
  const name = cleanTaskName(raw);
  if (name.length < 1 || name.length > MAX_NAME_LEN) {
    return { ok: false, status: 400, error: `Use 1\u2013${MAX_NAME_LEN} characters` };
  }
  const key = taskKey(name);

  const [count] = await sql<{ n: number }[]>`select count(*)::int as n from tasks`;
  if ((count?.n ?? 0) >= MAX_LIBRARY_TASKS) {
    return { ok: false, status: 409, error: `The list is full (${MAX_LIBRARY_TASKS} tasks). Delete one first.` };
  }

  // name_key is unique, so two requests racing with the same name can't both win.
  const [row] = await sql<PlanTask[]>`
    insert into tasks (name, name_key, sort_order)
    select ${name}::text, ${key}::text, coalesce(max(sort_order), -1) + 1 from tasks
    on conflict (name_key) do nothing
    returning id, name
  `;
  if (row) return { ok: true, task: row };

  const [same] = await sql<{ name: string }[]>`select name from tasks where name_key = ${key}`;
  const shown = same?.name ?? name;
  return {
    ok: false,
    status: 409,
    error: shown === name ? `"${shown}" is already in the list` : `That is the same task as "${shown}"`,
  };
}

/** Deletes a task from the list and from every day. Safe to repeat. */
export async function removeTask(id: string): Promise<void> {
  await ensureTaskLibrary();
  await sql`delete from tasks where id = ${id}`;
}

/**
 * Sets the days a task is on to exactly `days` (so a retry, or a second
 * device with a stale screen, can't flip anything the wrong way). A day it is
 * newly on gets it at the end of that day's order.
 */
export async function setTaskDays(id: string, days: number[]): Promise<{ ok: true } | Failure> {
  await ensureTaskLibrary();
  const wanted: number[] = [...new Set(days)].filter(isDay).sort((a, b) => a - b);
  try {
    return await sql.begin(async (tx): Promise<{ ok: true } | Failure> => {
      // Locking the task serialises two changes to it arriving together.
      const [task] = await tx<{ id: string }[]>`select id from tasks where id = ${id} for update`;
      if (!task) return { ok: false, status: 404, error: "That task is no longer in the list" };

      const have = await tx<{ day_index: number }[]>`select day_index from task_templates where task_id = ${id}`;
      const haveDays = new Set(have.map((h) => h.day_index));

      for (const d of haveDays) {
        if (!wanted.includes(d)) await tx`delete from task_templates where task_id = ${id} and day_index = ${d}`;
      }
      for (const d of wanted) {
        if (haveDays.has(d)) continue;
        const [c] = await tx<{ n: number; nxt: number }[]>`
          select count(*)::int as n, coalesce(max(sort_order), -1) + 1 as nxt
          from task_templates where day_index = ${d}
        `;
        if ((c?.n ?? 0) >= MAX_TASKS_PER_DAY) throw new DayFull(d);
        await tx`insert into task_templates (task_id, day_index, sort_order) values (${id}, ${d}, ${c?.nxt ?? 0})`;
      }
      return { ok: true };
    });
  } catch (err) {
    if (err instanceof DayFull) {
      return {
        ok: false,
        status: 409,
        error: `${DAY_LABELS[err.day as DayIndex]} already has ${MAX_TASKS_PER_DAY} tasks`,
      };
    }
    throw err;
  }
}

/**
 * Puts the list (no `dayIndex`) or one day's tasks in the order given. Anything
 * the request doesn't mention keeps its place after the ones it does, and only
 * rows whose position actually changes are written.
 */
export async function reorderTasks(orderedIds: string[], dayIndex?: DayIndex): Promise<void> {
  await ensureTaskLibrary();
  await sql.begin(async (tx) => {
    if (dayIndex === undefined) {
      const current = await tx<{ id: string; sort_order: number }[]>`
        select id, sort_order from tasks order by sort_order, created_at, id for update
      `;
      const order = mergeOrder(orderedIds, current.map((r) => r.id));
      const was = new Map(current.map((r) => [r.id, r.sort_order]));
      for (const [position, id] of order.entries()) {
        if (was.get(id) !== position) await tx`update tasks set sort_order = ${position} where id = ${id}`;
      }
      return;
    }
    const current = await tx<{ task_id: string; sort_order: number }[]>`
      select task_id, sort_order from task_templates where day_index = ${dayIndex}
      order by sort_order, task_id for update
    `;
    const order = mergeOrder(orderedIds, current.map((r) => r.task_id));
    const was = new Map(current.map((r) => [r.task_id, r.sort_order]));
    for (const [position, id] of order.entries()) {
      if (was.get(id) !== position) {
        await tx`update task_templates set sort_order = ${position} where task_id = ${id} and day_index = ${dayIndex}`;
      }
    }
  });
}
