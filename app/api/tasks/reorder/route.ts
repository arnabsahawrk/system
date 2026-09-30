import { NextResponse } from "next/server";
import { isUnlocked } from "@/lib/session";
import { reorderTemplateTasks } from "@/lib/task-templates";
import type { DayIndex } from "@/lib/types";

export async function POST(req: Request) {
  if (!(await isUnlocked())) return NextResponse.json({ error: "Locked" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const dayIndex = Number(body?.dayIndex);
  const orderedIds = Array.isArray(body?.orderedIds) ? body.orderedIds.filter((x: unknown) => typeof x === "string") : null;

  if (!Number.isInteger(dayIndex) || dayIndex < 0 || dayIndex > 6 || !orderedIds) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  await reorderTemplateTasks(dayIndex as DayIndex, orderedIds);
  return NextResponse.json({ ok: true });
}
