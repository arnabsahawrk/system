import { NextResponse } from "next/server";
import { isUuid } from "@/lib/api-params";
import { isUnlocked } from "@/lib/session";
import { reorderTasks } from "@/lib/task-templates";
import type { DayIndex } from "@/lib/types";

/** `{ orderedIds }` reorders the task list; add `dayIndex` to reorder one
 * day's tasks instead. Ids the request leaves out keep their place after it. */
export async function POST(req: Request) {
  if (!(await isUnlocked())) return NextResponse.json({ error: "Locked" }, { status: 401 });
  const body = await req.json().catch(() => null);
  const ids: unknown = body?.orderedIds;
  if (!Array.isArray(ids) || ids.length > 200 || !ids.every((id) => isUuid(id))) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  let dayIndex: DayIndex | undefined;
  if (body.dayIndex !== undefined) {
    const n = Number(body.dayIndex);
    if (!Number.isInteger(n) || n < 0 || n > 6) return NextResponse.json({ error: "Invalid body" }, { status: 400 });
    dayIndex = n as DayIndex;
  }

  await reorderTasks(ids as string[], dayIndex);
  return NextResponse.json({ ok: true });
}
