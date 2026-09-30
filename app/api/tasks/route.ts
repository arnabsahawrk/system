import { NextResponse } from "next/server";
import { isUnlocked } from "@/lib/session";
import { addTemplateTask, listTemplates } from "@/lib/task-templates";
import type { DayIndex } from "@/lib/types";

export async function GET() {
  if (!(await isUnlocked())) return NextResponse.json({ error: "Locked" }, { status: 401 });
  return NextResponse.json(await listTemplates());
}

/** Adding/removing here (see also [id]/route.ts) never changes the week
 * that's currently running — it only changes what the *next* rollover
 * snapshots. That delay isn't a queue to manage, it falls straight out of
 * createWeek() only reading this table at rollover time. */
export async function POST(req: Request) {
  if (!(await isUnlocked())) return NextResponse.json({ error: "Locked" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const dayIndex = Number(body?.dayIndex);
  const name = typeof body?.name === "string" ? body.name : "";

  if (!Number.isInteger(dayIndex) || dayIndex < 0 || dayIndex > 6) {
    return NextResponse.json({ error: "dayIndex must be 0–6" }, { status: 400 });
  }

  const result = await addTemplateTask(dayIndex as DayIndex, name);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json({ ok: true, id: result.id });
}
