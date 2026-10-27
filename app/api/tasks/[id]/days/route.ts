import { NextResponse } from "next/server";
import { isUuid } from "@/lib/api-params";
import { isUnlocked } from "@/lib/session";
import { setTaskDays } from "@/lib/task-templates";

/** `{ "days": [0, 2, 4] }` sets the days a task is on to exactly that (0 =
 * Saturday … 6 = Friday). Safe to repeat, and safe from a second device whose
 * screen is out of date. */
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isUnlocked())) return NextResponse.json({ error: "Locked" }, { status: 401 });
  const { id } = await params;
  const body = await req.json().catch(() => null);
  const days: unknown = body?.days;
  const valid =
    Array.isArray(days) && days.length <= 7 && days.every((d) => Number.isInteger(d) && d >= 0 && d <= 6);
  if (!isUuid(id) || !valid) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  const result = await setTaskDays(id, days as number[]);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ ok: true });
}
